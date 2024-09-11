import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
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
    link: `${
      p.brand === brandEnum[0] ? PINCH_URL : BOB_URL
    }/${p._id.toString()}`, // TODO: change it when url is generated from slug instead of id
    imageLink: p.images[0].location,
    additionalImageLinks: [p.images[1].location],
    contentLanguage: 'en',
    targetCountry: 'SG',
    channel: 'online',
    availability: p.available ? 'in stock' : 'out of stock',
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
