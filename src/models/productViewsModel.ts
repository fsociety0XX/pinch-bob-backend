import mongoose, { model, Schema } from 'mongoose';

interface IProductViews {
  product: mongoose.Types.ObjectId;
  date: Date;
  views: number;
}

const productViewsSchema = new Schema<IProductViews>({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  date: { type: Date, required: true, index: true },
  views: { type: Number, default: 1 },
});

productViewsSchema.index({ product: 1, date: 1 }, { unique: true });

const ProductViewsModel = model<IProductViews>(
  'ProductViews',
  productViewsSchema
);

export default ProductViewsModel;
