/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable import/prefer-default-export */
// @ts-nocheck

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product, { IProduct } from '@src/models/productModel';
import catchAsync from '@src/utils/catchAsync';
import AppError from '@src/utils/appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { StatusCode } from '@src/types/customTypes';

async function getProductBySuperCategory(
  brand: string,
  superCategory: string,
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  const product = await Product.aggregate([
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
        _id: { $nin: excludedIds },
        brand,
        active: true,
        available: true,
        'superCategory.name': superCategory,
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
        refImageType: 1,
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 20 },
    { $sample: { size: 1 } },
  ]).then((result) => {
    return result[0];
  });
  return product;
}

async function getProductBySuperCategoryAndCategory(
  brand: string,
  superCategory: string,
  categoryName: string,
  categoryId: mongoose.Types.ObjectId,
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  const product = await Product.aggregate([
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
      },
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
          {
            active: true,
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
          // { 'category.0': { $exists: true, $ne: null } },
          { 'category.name': categoryName },
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
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        as: 'subCategory',
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
        refImageType: 1,
        superCategory: {
          $map: {
            input: '$superCategory',
            as: 'sc',
            in: {
              _id: '$$sc._id',
              name: '$$sc.name',
              active: '$$sc.active',
            },
          },
        },
        category: {
          $map: {
            input: '$category',
            as: 'cat',
            in: {
              _id: '$$cat._id',
              name: '$$cat.name',
              active: '$$cat.active',
            },
          },
        },
        subCategory: {
          $map: {
            input: '$subCategory',
            as: 'sub',
            in: {
              _id: '$$sub._id',
              name: '$$sub.name',
              active: '$$sub.active',
            },
          },
        },
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 20 },
    { $sample: { size: 1 } },
  ]).then((result) => {
    return result[0];
  });
  return product;
}

async function getRandomProducts(
  brand: string,
  sampleSize: number,
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  const randomProducts = await Product.aggregate([
    {
      $match: {
        _id: { $nin: excludedIds },
        brand,
        active: true,
        available: true,
      },
    },
    {
      $sample: { size: sampleSize },
    },
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
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
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        as: 'subCategory',
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
        refImageType: 1,
        superCategory: {
          $map: {
            input: '$superCategory',
            as: 'sc',
            in: {
              _id: '$$sc._id',
              name: '$$sc.name',
              active: '$$sc.active',
            },
          },
        },
        category: {
          $map: {
            input: '$category',
            as: 'cat',
            in: {
              _id: '$$cat._id',
              name: '$$cat.name',
              active: '$$cat.active',
            },
          },
        },
        subCategory: {
          $map: {
            input: '$subCategory',
            as: 'sub',
            in: {
              _id: '$$sub._id',
              name: '$$sub.name',
              active: '$$sub.active',
            },
          },
        },
      },
    },
  ]);
  return randomProducts;
}

async function getRandomProductsFromSameSupercategory(
  brand: string,
  sampleSize: number,
  excludedIds: Array<mongoose.Types.ObjectId>,
  superCategory: string
) {
  const randomProducts = await Product.aggregate([
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
      },
    },
    {
      $match: {
        $and: [
          { 'superCategory.name': superCategory },
          { brand },
          { active: true },
          { available: true },
        ],
        _id: { $nin: excludedIds },
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
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        as: 'subCategory',
      },
    },
    {
      $sample: { size: sampleSize },
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
        refImageType: 1,
        superCategory: {
          $map: {
            input: '$superCategory',
            as: 'sc',
            in: {
              _id: '$$sc._id',
              name: '$$sc.name',
              active: '$$sc.active',
            },
          },
        },
        category: {
          $map: {
            input: '$category',
            as: 'cat',
            in: {
              _id: '$$cat._id',
              name: '$$cat.name',
              active: '$$cat.active',
            },
          },
        },
        subCategory: {
          $map: {
            input: '$subCategory',
            as: 'sub',
            in: {
              _id: '$$sub._id',
              name: '$$sub.name',
              active: '$$sub.active',
            },
          },
        },
      },
    },
  ]);
  return randomProducts;
}

async function getGiftCardProduct(
  brand: string,
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  const result = await Product.aggregate([
    {
      $match: {
        brand,
        active: true,
        available: true,
        _id: { $nin: excludedIds },
        name: { $regex: /gift card/i },
      },
    },
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
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
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        as: 'subCategory',
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
        refImageType: 1,
        superCategory: {
          $map: {
            input: '$superCategory',
            as: 'sc',
            in: { _id: '$$sc._id', name: '$$sc.name', active: '$$sc.active' },
          },
        },
        category: {
          $map: {
            input: '$category',
            as: 'cat',
            in: {
              _id: '$$cat._id',
              name: '$$cat.name',
              active: '$$cat.active',
            },
          },
        },
        subCategory: {
          $map: {
            input: '$subCategory',
            as: 'sub',
            in: {
              _id: '$$sub._id',
              name: '$$sub.name',
              active: '$$sub.active',
            },
          },
        },
      },
    },
    { $limit: 1 },
  ]);
  return result[0];
}

async function getTopBySuperAndCategoryName(
  brand: string,
  superCategory: string,
  categoryName: string,
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  const [product] = await Product.aggregate([
    {
      $match: {
        _id: { $nin: excludedIds },
        brand,
        active: true,
        available: true,
      },
    },
    {
      $lookup: {
        from: 'supercategories',
        localField: 'superCategory',
        foreignField: '_id',
        as: 'superCategory',
      },
    },
    { $unwind: '$superCategory' },
    { $match: { 'superCategory.name': superCategory } },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
      },
    },
    // now that "category" is an array of category docs, match by name:
    { $match: { 'category.name': categoryName } },
    {
      $project: {
        _id: 1,
        name: 1,
        images: 1,
        price: 1,
        discountedPrice: 1,
        slug: 1,
        brand: 1,
        refImageType: 1,
        // you can keep these if your client needs them:
        superCategory: 1,
        category: 1,
        subCategory: 1,
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 40 },
    { $sample: { size: 1 } },
  ]);
  return product;
}

async function tryCategoryListInOrder(
  brand: string,
  superCategory: string,
  categoryNames: string[],
  excludedIds: Array<mongoose.Types.ObjectId>
) {
  /* eslint-disable no-await-in-loop */
  for (const name of categoryNames) {
    const p = await getTopBySuperAndCategoryName(
      brand,
      superCategory,
      name,
      excludedIds
    );
    if (p && Object.keys(p).length) return p;
  }
  /* eslint-enable no-await-in-loop */
  return undefined;
}

const insertIntoFbtSlot = (
  slot: IProduct,
  fbtDocs: IProduct[],
  excludedIds: mongoose.Types.ObjectId[]
) => {
  if (Object.keys(slot)?.length) {
    excludedIds.push(new mongoose.Types.ObjectId(slot._id));
    fbtDocs.push(slot);
  }
};

export const getFbtAlsoLike = catchAsync(
  async (req: Request, res: Response) => {
    const productId = req.params.id!;
    const superCategories = [
      'Classic Cakes',
      'Customised',
      'Pastries',
      'Seasonal',
      'Accessories',
    ];

    const product = await Product.findById(productId).select(
      'brand superCategory'
    );
    if (!product) {
      throw new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
    }

    const superCategory = product.superCategory[0].name;
    const category = product.category[0]; // get the first category to be used for Customised Cakes and Seasonal
    const { brand } = product;
    const alsoLikeDocs: IProduct[] = [];
    const noOfSlots = 3;
    const noOfMayLikeProducts = 10;
    const fbtDocs: IProduct[] = [];
    const excludedIds: mongoose.Types.ObjectId[] = [];

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
          superCategories[2],
          excludedIds
        );
        if (slotOne && Object.keys(slotOne)?.length) {
          insertIntoFbtSlot(slotOne, fbtDocs, excludedIds);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[2],
          excludedIds
        );
        if (slotTwo && Object.keys(slotTwo)?.length) {
          insertIntoFbtSlot(slotTwo, fbtDocs, excludedIds);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[2],
          excludedIds
        );
        if (slotThree && Object.keys(slotThree)?.length) {
          insertIntoFbtSlot(slotThree, fbtDocs, excludedIds);
        }

        // You may also like
        const randomClassicProducts =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[0]
          );
        if (randomClassicProducts?.length) {
          randomClassicProducts.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[1]: {
        // Customised
        slotOne = await tryCategoryListInOrder(
          brand,
          superCategories[1],
          ['Bento-Cakes', 'Mini-Customised-Cakes', 'Customised-Cupcakes'],
          excludedIds
        );
        if (slotOne && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne, fbtDocs, excludedIds);
        }

        // Slot 2: "Customised Cupcake" OR "Bento Cake" OR "Mini Customised Cakes"
        slotTwo = await tryCategoryListInOrder(
          brand,
          superCategories[1],
          ['Customised-Cupcakes', 'Bento-Cakes', 'Mini-Customised-Cakes'],
          excludedIds
        );

        if (slotTwo && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo, fbtDocs, excludedIds);
        }

        // Slot 3: "Pastries" OR "Fondant" OR "Candles"
        // First attempt: anything from the Pastries supercategory
        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[2],
          excludedIds
        ); // "Pastries"
        if (!slotThree) {
          // Fallbacks from Accessories by specific categories
          slotThree =
            (await getTopBySuperAndCategoryName(
              brand,
              superCategories[4],
              'Fondant',
              excludedIds
            )) || // Fondant Toppers
            (await getTopBySuperAndCategoryName(
              brand,
              superCategories[4],
              'Candles',
              excludedIds
            ));
        }
        if (slotThree && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree, fbtDocs, excludedIds);
        }

        // You may also like
        const randomCustomisedCakes =
          await getRandomProductsFromSameSupercategory(
            brand,
            noOfMayLikeProducts,
            excludedIds,
            superCategories[1]
          );
        if (randomCustomisedCakes?.length) {
          randomCustomisedCakes.forEach((p) => {
            alsoLikeDocs.push(p);
          });
        }
        break;
      }
      case superCategories[2]: {
        // Pastries
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[0],
          excludedIds
        );
        if (slotOne && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne, fbtDocs, excludedIds);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (slotTwo && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo, fbtDocs, excludedIds);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[3],
          excludedIds
        );
        if (slotThree && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree, fbtDocs, excludedIds);
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
      case superCategories[3]: {
        slotOne = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[3],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotOne !== 'undefined' && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne, fbtDocs, excludedIds);
        }

        slotTwo = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[3],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotTwo !== 'undefined' && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo, fbtDocs, excludedIds);
        }

        slotThree = await getProductBySuperCategoryAndCategory(
          brand,
          superCategories[2],
          category.name,
          category._id,
          excludedIds
        );
        if (typeof slotThree !== 'undefined' && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree, fbtDocs, excludedIds);
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
      case superCategories[4]: {
        // Accessories
        slotOne = await getProductBySuperCategory(
          brand,
          superCategories[2],
          excludedIds
        );
        if (slotOne && Object.keys(slotOne).length) {
          insertIntoFbtSlot(slotOne, fbtDocs, excludedIds);
        }

        slotTwo = await getProductBySuperCategory(
          brand,
          superCategories[2],
          excludedIds
        );
        if (slotTwo && Object.keys(slotTwo).length) {
          insertIntoFbtSlot(slotTwo, fbtDocs, excludedIds);
        }

        slotThree = await getProductBySuperCategory(
          brand,
          superCategories[4],
          excludedIds
        );
        if (slotThree && Object.keys(slotThree).length) {
          insertIntoFbtSlot(slotThree, fbtDocs, excludedIds);
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

    // Always pin a Gift Card at position 1 of alsoLikeDocs (index 0)
    const giftCard = await getGiftCardProduct(brand, excludedIds);
    if (giftCard) {
      // remove if already present
      const idx = alsoLikeDocs.findIndex(
        (p) => String(p._id) === String(giftCard._id)
      );
      if (idx !== -1) alsoLikeDocs.splice(idx, 1);

      // put at the front
      alsoLikeDocs.unshift(giftCard);

      // prevent duplicates from later queries
      excludedIds.push(new mongoose.Types.ObjectId(giftCard._id));
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

    // Cap the list length after topping up (ensures exactly up to noOfMayLikeProducts)
    if (alsoLikeDocs.length > noOfMayLikeProducts) {
      alsoLikeDocs.splice(noOfMayLikeProducts);
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: { fbt: fbtDocs, alsoLike: alsoLikeDocs },
    });
    return false;
  }
);
