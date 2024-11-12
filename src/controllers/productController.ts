import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import mongoose from 'mongoose';
import Product, { IProduct } from '@src/models/productModel';
import catchAsync from '@src/utils/catchAsync';
import {
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { brandEnum, StatusCode } from '@src/types/customTypes';

async function uploadProducts(p: IProduct) {
  const PINCH_URL = 'https://pinchbakehouse.com/details';
  const BOB_URL = 'https://bobthebakerboy.com';

  // Initialize authentication
  const authClient = new GoogleAuth({
    keyFile: path.resolve(__dirname, '../../pinchGmerchant.json'), // TODO: Add condition for Bob
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
    await content.products.insert({
      merchantId: process.env.GOOGLE_MERCHANT_ID,
      requestBody: googleProduct,
    });
  } catch (error) {
    console.error(
      'Error while uploading products to google merchant center:',
      error
    );
  }
}

export const updateProduct = updateOne(Product);
export const getOneProduct = getOne(Product, {
  path: 'sizeDetails.size piecesDetails.pieces flavour colour category',
  select: 'name',
});
export const getAllProduct = getAll(Product, ['size', 'name']);
export const deleteProduct = deleteOne(Product);
export const getOneProductViaSlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const doc = await Product.findOne({ slug });
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  if (req.files?.length) {
    req.body.images = req.files;
  }
  if (req.file) {
    req.body.image = req.file;
  }
  const product = await Product.create(req.body);
  await uploadProducts(product);
  res.status(StatusCode.CREATE).json({
    status: 'success',
    data: {
      data: product,
    },
  });
});

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

const getProductByCategory = (
  brand: string,
  superCategory: string,
  excludedIds: Array<mongoose.Types.ObjectId>
) => {
  const product = Product.aggregate([
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
      },
    },
    {
      $unwind: '$superCategory',
    },
    {
      $match: {
        $and: [
          {
            'superCategory.name': superCategory,
          },
          {
            brand,
          },
        ],
        _id: {
          $nin: excludedIds,
        },
      },
    },
    {
      $project: {
        name: 1,
        images: 1,
        price: 1,
        discountedPrice: 1,
        slug: 1,
        brand: 1,
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 1 },
  ]).then((result) => {
    return result[0];
  });
  return product;
};

const getRandomProducts = (
  brand: string,
  sampleSize: number,
  excludedIds: Array<mongoose.Types.ObjectId>
) => {
  const randomProducts = Product.aggregate([
    {
      $sample: { size: 5 },
    },
    {
      $match: {
        _id: { $nin: excludedIds },
        brand,
      },
    },
    {
      $project: {
        name: 1,
        images: 1,
        price: 1,
        discountedPrice: 1,
        slug: 1,
        brand: 1,
      },
    },
    { $limit: sampleSize },
  ]);
  return randomProducts;
};

export const getFbtAlsoLike = catchAsync(
  async (req: Request, res: Response) => {
    const productId = req.params.id!;
    const superCategories = [
      'Classic Cakes',
      'Customised Cakes',
      'Customised Cupcakes',
      'Pastries',
      'Seasonal',
      'Accessories',
    ];

    const product = await Product.findById(productId).select(
      'brand superCategory'
    );
    if (!product) {
      return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
    }

    const superCategory = product.superCategory[0].name;
    const { brand } = product;
    const docs: IProduct[] = [];
    const excludedIds: mongoose.Types.ObjectId[] = [];
    const noOfSlots = 3;

    // exclude the current product from showing in FBT
    excludedIds.push(new mongoose.Types.ObjectId(product._id));

    const insertIntoSlot = (slot: IProduct) => {
      if (typeof slot !== 'undefined') {
        excludedIds.push(new mongoose.Types.ObjectId(slot._id));
        docs.push(slot);
      }
    };

    let slotOne;
    let slotTwo;
    let slotThree;
    switch (superCategory) {
      case superCategories[0]:
        // Classic Cakes
        slotOne = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotOne);

        slotTwo = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotTwo);

        slotThree = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotThree);

        break;
      case superCategories[1]:
        console.log('Customised Cakes');
        break;
      case superCategories[2]:
        console.log('Customised Cupcakes');
        // Customised Cupcakes
        slotOne = await getProductByCategory(
          brand,
          superCategories[1],
          excludedIds
        );
        insertIntoSlot(slotOne);

        slotTwo = await getProductByCategory(
          brand,
          superCategories[1],
          excludedIds
        );
        insertIntoSlot(slotTwo);

        slotThree = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotThree);

        break;
      case superCategories[3]:
        // Pastries
        slotOne = await getProductByCategory(
          brand,
          superCategories[0],
          excludedIds
        );
        insertIntoSlot(slotOne);

        slotTwo = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotTwo);

        slotThree = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotThree);

        break;
      case superCategories[4]:
        console.log('Seasonal');
        break;
      case superCategories[5]:
        // Accessories
        slotOne = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotOne);

        slotTwo = await getProductByCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        insertIntoSlot(slotTwo);

        slotThree = await getProductByCategory(
          brand,
          superCategories[5],
          excludedIds
        );
        insertIntoSlot(slotThree);

        break;
      default:
        break;
    }

    // If any of the slots are empty, retrieve random & unique products for these empty slots
    // If all slots are empty, retrieve random products for all the slots
    if (docs.length < noOfSlots) {
      const randomProducts = await getRandomProducts(
        brand,
        noOfSlots - docs.length,
        excludedIds
      );
      if (randomProducts.length) {
        randomProducts.forEach((p) => {
          docs.push(p);
        });
      }
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: docs,
    });
    return false;
  }
);
