import mongoose, { Types } from 'mongoose';

interface ICategory {
  _id: mongoose.ObjectId;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IProduct {
  name: string;
  price: number;
  discountedPrice: number;
  currency: string;
  brand: string;
  pieces: number;
  size: string[];
  images: string[];
  flavour: string[];
  type: string;
  details: {
    details: string;
    dietaryAdvice: string;
    shelfLife: string;
    sizesAndPortions: string;
  };
  maxQty: number;
  recommended: boolean;
  active: boolean;
  category: Types.DocumentArray<ICategory>;
  fbt: string[];
}

// const productSchema = new mongoose.Schema<IProduct>({
//   name: {
//     type: String,
//     required: [true, 'A product must have a name'],
//   },
// });
