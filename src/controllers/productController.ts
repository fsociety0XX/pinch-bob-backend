/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

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
import logActivity, { ActivityActions } from '@src/utils/activityLogger';

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

  const pinchLink = `${PINCH_URL}/details/${p.slug}`;
  const bobLink = `${BOB_URL}/${p?.superCategory?.[0].name}/${p.slug}`;

  const googleProduct = {
    offerId: p._id.toString(),
    title: p.name,
    description:
      p.brand === brandEnum[0]
        ? p.pinchDetails.details
        : p.bobDetails?.description || '',
    link: p.brand === brandEnum[0] ? pinchLink : bobLink,
    imageLink: p.images[0].location,
    additionalImageLinks: [p?.images?.[1] ? p.images[1].location : ''],
    contentLanguage: 'en',
    targetCountry: 'SG',
    channel: 'online',
    availability: 'in stock',
    condition: 'new',
    price: {
      value: p.price.toString(),
      currency: 'SGD',
    },
    brand: p.brand === brandEnum[0] ? 'Pinch Bakehouse' : 'Bob the Baker Boy',
  };

  try {
    if (isUpdate) {
      const googleProductToUpdate = { ...googleProduct };
      delete googleProductToUpdate.offerId;

      // Update existing product in Google Merchant Center
      await content.products.update({
        merchantId: process.env.GOOGLE_MERCHANT_ID,
        productId: `online:en:SG:${googleProduct.offerId}`,
        requestBody: googleProductToUpdate,
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

const getInventoryStatus = (remainingQty: number): string => {
  if (remainingQty === 0) return inventoryEnum[0]; // "Out of stock"
  if (remainingQty <= 20) return inventoryEnum[1]; // "Low stock"
  return inventoryEnum[2]; // "In stock"
};

const inventorySetup = (i: IInventory, existingInventory?: IInventory) => {
  const inventory = { ...i };

  if (inventory && inventory.track && inventory.totalQty >= 0) {
    // Handle restocking: if totalQty increased, update remainingQty accordingly
    if (existingInventory && existingInventory.totalQty !== undefined) {
      const qtyDifference = inventory.totalQty - existingInventory.totalQty;
      if (qtyDifference > 0) {
        // Restocking: add the difference to remainingQty
        inventory.remainingQty =
          (existingInventory.remainingQty || 0) + qtyDifference;
      } else if (qtyDifference < 0) {
        // Reducing total: adjust remainingQty but don't go below 0
        inventory.remainingQty = Math.max(
          0,
          (existingInventory.remainingQty || 0) + qtyDifference
        );
      } else {
        // Total qty unchanged, keep existing remainingQty
        inventory.remainingQty =
          existingInventory.remainingQty || inventory.totalQty;
      }
    } else {
      // New product or no existing inventory: set remainingQty = totalQty
      inventory.remainingQty = inventory.totalQty;
    }

    inventory.status = getInventoryStatus(inventory.remainingQty);
  } else if (inventory && !inventory.track) {
    // Not tracking inventory: set status to "In stock"
    inventory.status = inventoryEnum[2]; // "In stock"
  }

  return inventory;
};

export const updateProduct = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const brand = req.body?.brand;

    if (req.files?.length) {
      req.body.images = req.files;
    }

    // Normalize fields to avoid empty strings
    const stringArrays = [
      'flavour',
      'colour',
      'sizeDetails',
      'piecesDetails',
      'cardOptions',
      'fondantMsgOptions',
      'category',
      'fbt',
      'tag',
      'filterColours',
      'subCategory',
    ];

    for (const key of stringArrays) {
      if (req.body[key] === '') {
        req.body[key] = [];
      }
    }

    const updatedPayload = { ...req.body };
    const before = await Product.findById(req.params.id);

    // Handle inventory setup
    if (updatedPayload?.inventory) {
      const existingInventory = before?.inventory;

      const updatedInventory = inventorySetup(
        updatedPayload.inventory,
        existingInventory
      );
      updatedPayload.inventory = updatedInventory;
      updatedPayload.maxQty = updatedInventory.remainingQty;

      // Set product availability based on tracking status
      if (updatedInventory.track) {
        // Tracking enabled: availability based on remainingQty
        updatedPayload.available = updatedInventory.remainingQty > 0;
      } else {
        // Tracking disabled: always available
        updatedPayload.available = true;
      }
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

    // ✅ Audit log
    if (req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions.UPDATE_PRODUCT,
        module: 'product',
        targetId: product._id.toString(),
        metadata: {
          before,
          after: product,
          reason: 'Manual product update',
        },
        brand,
      });
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

    if (req.query.tag) {
      req.query.tag = {
        $in: (req.query.tag as string).split(','),
      };
    }

    if (req.query.colour) {
      req.query.colour = {
        $in: (req.query.colour as string).split(','),
      };
    }

    if (req.query.tag) {
      // Handle both string and array cases for tag parameter
      const tagValue = req.query.tag;
      if (typeof tagValue === 'string') {
        req.query.tag = {
          $in: tagValue.split(','),
        };
      } else if (Array.isArray(tagValue)) {
        req.query.tag = {
          $in: tagValue,
        };
      }
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

    if (req.query.slug) {
      req.query.slug = (req.query.slug as string).split(',');
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
export const deleteProduct = deleteOne(Product, {
  action: ActivityActions.DELETE_PRODUCT,
  module: 'product',
});
export const getOneProductViaSlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { brand } = req.body;
    const doc = await Product.findOne({ slug, brand });
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
    if (req.body.subCategory === '') {
      req.body.subCategory = [];
    }
    const updatedPayload = { ...req.body };
    if (updatedPayload?.inventory) {
      const updatedInventory = inventorySetup(updatedPayload.inventory);
      updatedPayload.inventory = updatedInventory;
      updatedPayload.maxQty = updatedInventory.remainingQty;

      // Set product availability based on tracking status
      if (updatedInventory.track) {
        // Tracking enabled: availability based on remainingQty
        updatedPayload.available = updatedInventory.remainingQty > 0;
      } else {
        // Tracking disabled: always available
        updatedPayload.available = true;
      }
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

export const checkGlobalSearchParams = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const name = (req.query.name as string) || '';
    const brand = (req.query.brand as string) || '';

    req.query.name = { $regex: name, $options: 'i' };
    req.query.brand = brand;
    req.query.fields =
      'name,images,price,discountedPrice,slug,category,superCategory,tag,available';

    next();
  }
);
