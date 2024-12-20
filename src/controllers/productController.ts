/* eslint-disable prefer-destructuring */
import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import Product, { IInventory, IProduct } from '@src/models/productModel';
import catchAsync from '@src/utils/catchAsync';
import { deleteOne, getAll, getOne } from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { brandEnum, inventoryEnum, StatusCode } from '@src/types/customTypes';
import { PRODUCTION } from '@src/constants/static';
import ProductViewsModel from '@src/models/productViewsModel';

async function syncProductWithMerchantCenter(
  p: IProduct,
  brand: string,
  isUpdate = false
) {
  const PINCH_URL = 'https://pinchbakehouse.com';
  const BOB_URL = 'https://bobthebakerboy.com';
  const PINCH_JSON = path.resolve(__dirname, '../../pinchGmerchant.json');
  const BOB_JSON = path.resolve(__dirname, '../../bobGmerchant.json');

  // Initialize authentication
  const authClient = new GoogleAuth({
    keyFile: brand === brandEnum[0] ? PINCH_JSON : BOB_JSON,
    scopes: ['https://www.googleapis.com/auth/content'],
  });

  // Create a client for the Content API
  const content = google.content({
    version: 'v2.1',
    auth: authClient,
  });

  const googleProduct = {
    offerId: p._id.toString(),
    title: p.name,
    description:
      p.brand === brandEnum[0]
        ? p.pinchDetails.details
        : p.bobDetails.description[0],
    link: `${p.brand === brandEnum[0] ? PINCH_URL : BOB_URL}/details/${p.slug}`,
    imageLink: p.images[0].location,
    additionalImageLinks: [p?.images?.[1] ? p.images[1].location : ''],
    contentLanguage: 'en',
    targetCountry: 'SG',
    channel: 'online',
    availability: p?.inventory?.available ? 'in stock' : 'out of stock',
    condition: 'new',
    price: {
      value: p.price.toString(),
      currency: 'SGD',
    },
    brand: p.brand === brandEnum[0] ? 'Pinch Bakehouse' : 'Bob the Baker Boy',
  };

  try {
    if (isUpdate) {
      // Update existing product in Google Merchant Center
      await content.products.update({
        merchantId: process.env.GOOGLE_MERCHANT_ID,
        productId: googleProduct.offerId,
        requestBody: googleProduct,
      });
    } else {
      // Insert a new product in Google Merchant Center
      await content.products.insert({
        merchantId: process.env.GOOGLE_MERCHANT_ID,
        requestBody: googleProduct,
      });
    }
  } catch (error) {
    console.error(
      'Error while syncing products to google merchant center:',
      error
    );
  }
}

const inventorySetup = (i: IInventory) => {
  const inventory = { ...i };
  if (inventory && inventory.track && inventory.totalQty >= 0) {
    inventory.remainingQty = inventory.totalQty;
    inventory.available = inventory.remainingQty > 0;

    // Set status based on remainingQty
    if (!inventory.remainingQty) {
      inventory.status = inventoryEnum[0];
    } else if (inventory.remainingQty <= 20) {
      inventory.status = inventoryEnum[1];
    } else {
      inventory.status = inventoryEnum[2];
    }
  }

  return inventory;
};

export const updateProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const brand = req.body?.brand;
    if (req.files?.length) {
      req.body.images = req.files;
    }
    if (!req.body?.colour) {
      req.body.colour = [];
    }
    if (!req.body?.flavour) {
      req.body.flavour = [];
    }
    const updatedPayload = { ...req.body };
    if (updatedPayload?.inventory) {
      updatedPayload.inventory = inventorySetup(updatedPayload.inventory);
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updatedPayload,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!product) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (process.env.NODE_ENV === PRODUCTION) {
      await syncProductWithMerchantCenter(product, brand, true);
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: product,
      },
    });
  }
);

// $in operators used when we have to filter results from array and for rest we
// have not used any operator since we directly looked for value inside object rather than array
export const getAllProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.category) {
      req.query.category = {
        $in: (req.query.category as string).split(','),
      };
    }

    if (req.query.colour) {
      req.query.colour = {
        $in: (req.query.colour as string).split(','),
      };
    }

    if (req.query.tag) {
      req.query.tag = {
        $in: (req.query.tag as string).split(','),
      };
    }

    if (req.query.filterColours) {
      req.query.filterColours = {
        $in: (req.query.filterColours as string).split(','),
      };
    }

    if (req.query.size) {
      req.query['sizeDetails.size'] = (req.query.size as string).split(',');
      delete req.query.size;
    }

    if (req.query.inventoryStatus) {
      req.query['inventory.status'] = (
        req.query.inventoryStatus as string
      ).split(',');
      delete req.query.inventoryStatus;
    }

    await getAll(Product)(req, res, next);
  }
);

export const getOneProduct = getOne(Product);
export const deleteProduct = deleteOne(Product);
export const getOneProductViaSlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const doc = await Product.findOne({ slug });
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    const filter = {
      product: doc._id,
      date: new Date().setHours(0, 0, 0, 0),
    };
    await ProductViewsModel.findOneAndUpdate(
      filter,
      { $inc: { views: 1 } },
      { upsert: true }
    );
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);

export const createProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const brand = req.body?.brand;
    if (req.files?.length) {
      req.body.images = req.files;
    }
    const updatedPayload = { ...req.body };
    if (updatedPayload?.inventory) {
      updatedPayload.inventory = inventorySetup(updatedPayload.inventory);
    }

    const product = await Product.create(updatedPayload);
    if (!product) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (process.env.NODE_ENV === PRODUCTION) {
      await syncProductWithMerchantCenter(product, brand);
    }
    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: product,
      },
    });
  }
);

export const globalSearch = getAll(Product);
export const checkGlobalSearchParams = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const name = (req.query.name as string) || '';
    const brand = (req.query.brand as string) || '';

    req.query.name = { $regex: name, $options: 'i' };
    req.query.brand = brand;
    req.query.fields = 'name,images,price,discountedPrice,slug';

    next();
  }
);
