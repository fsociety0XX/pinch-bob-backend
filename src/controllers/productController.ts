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

const getProductBySuperCategory = (
  brand: string,
  superCategory: string,
  excludedIds: Array<mongoose.Types.ObjectId>
) => {
  Product.aggregate([
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
  ])
    .then((result) => {
      return result[0];
    })
    .catch((error) => {
      console.error(
        'Error occurred while executing getProductBySuperCategory.',
        error
      );
      return {};
    });
};

const getProductBySuperCategoryAndCategory = (
  brand: string,
  superCategory: string,
  categoryName: string,
  categoryId: mongoose.Types.ObjectId,
  excludedIds: Array<mongoose.Types.ObjectId>
) => {
  Product.aggregate([
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
      $match: {
        $and: [
          { 'category.0': { $exists: true, $ne: null } },
          { 'category.0': categoryId },
        ],
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $unwind: '$category',
    },
    {
      $match: {
        $and: [
          {
            'category.name': categoryName,
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
        _id: 1,
        name: 1,
        images: 1,
        price: 1,
        discountedPrice: 1,
        slug: 1,
        brand: 1,
        category: 1,
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 1 },
  ])
    .then((result) => {
      return result[0];
    })
    .catch((error) => {
      console.error(
        'Error occurred while executing getProductBySuperCategoryAndCategory.',
        error
      );
      return {};
    });
};

const getRandomProducts = (
  brand: string,
  sampleSize: number,
  excludedIds: Array<mongoose.Types.ObjectId>
) => {
  const randomProducts = Product.aggregate([
    {
      $match: {
        _id: { $nin: excludedIds },
        brand,
      },
    },
    {
      $sample: { size: sampleSize },
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
  ]);
  return randomProducts;
};

const getRandomProductsFromSameSupercategory = (
  brand: string,
  sampleSize: number,
  excludedIds: Array<mongoose.Types.ObjectId>,
  superCategory: string
) => {
  const randomProducts = Product.aggregate([
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
      $sample: { size: sampleSize },
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
  ]);
  return randomProducts;
};

const fbtDocs: IProduct[] = [];
const excludedIds: mongoose.Types.ObjectId[] = [];

const insertIntoFbtSlot = (slot: IProduct) => {
  if (Object.keys(slot).length) {
    excludedIds.push(new mongoose.Types.ObjectId(slot._id));
    fbtDocs.push(slot);
  }
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
    const category = product.category[0]; // get the first category to be used for Customised Cakes and Seasonal
    const { brand } = product;
    const alsoLikeDocs: IProduct[] = [];
    const noOfSlots = 3;
    const noOfMayLikeProducts = 10;

    // exclude the current product from showing in FBT
    excludedIds.push(new mongoose.Types.ObjectId(product._id));

    let slotOne;
    let slotTwo;
    let slotThree;

    fbtDocs.length = 0; // reset the array first

    switch (superCategory) {
      case superCategories[0]: {
        // Classic Cakes
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomClassicProducts =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[0]
          );
        if (randomClassicProducts.length) {
          randomClassicProducts.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[1]: {
        console.log('Customised Cakes');

        slotOne = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[2],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[2],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[3],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomCustomisedCakes =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[1]
          );
        if (randomCustomisedCakes.length) {
          randomCustomisedCakes.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[2]: {
        console.log('Customised Cupcakes');
        // Customised Cupcakes
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[1],
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[1],
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomCustomisedCupcakes =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[2]
          );
        if (randomCustomisedCupcakes.length) {
          randomCustomisedCupcakes.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[3]: {
        // Pastries
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[0],
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomPastries = await getRandomProductsFromSameSupercategory(
          brand,
          noOfMayLikeProducts,
          excludedIds,
          superCategories[3]
        );
        if (randomPastries.length) {
          randomPastries.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }

        break;
      }
      case superCategories[4]: {
        console.log('Seasonal');

        slotOne = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[4],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[4],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[3],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomCustomisedCakes =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[1]
          );
        if (randomCustomisedCakes.length) {
          randomCustomisedCakes.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[5]: {
        // Accessories
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[5],
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree);
        }

        // You may also like
        const randomAccessories = await getRandomProductsFromSameSupercategory(
          brand,
          noOfMayLikeProducts,
          excludedIds,
          superCategories[4]
        );
        if (randomAccessories.length) {
          randomAccessories.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }

        break;
      }
      default:
        break;
    }

    // If any of the slots are empty, retrieve random & unique products for these empty slots
    // If all slots are empty, retrieve random products for all the slots
    if (fbtDocs.length < noOfSlots) {
      const randomProducts = await getRandomProducts(
        brand,
        noOfSlots - fbtDocs.length,
        excludedIds
      );

      if (randomProducts.length) {
        randomProducts.forEach((p) => {
          fbtDocs.push(p);
        });
      }
    }

    if (alsoLikeDocs.length < noOfMayLikeProducts) {
      const randomProducts = await getRandomProducts(
        brand,
        noOfMayLikeProducts - alsoLikeDocs.length,
        excludedIds
      );
      if (randomProducts.length) {
        randomProducts.forEach((p) => {
          alsoLikeDocs.push(p);
        });
      }
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: [{ fbt: fbtDocs }, { alsoLike: alsoLikeDocs }],
    });
    return false;
  }
);
