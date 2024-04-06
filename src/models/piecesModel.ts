import mongoose, { Query } from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface IPieces {
  brand: string;
  name: string;
  active: boolean;
}

const piecesSchema = new mongoose.Schema<IPieces>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    name: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.name],
      unique: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

piecesSchema.pre<Query<IPieces, IPieces>>(/^find/, function (next) {
  this.where({ active: true });
  next();
});

const Pieces = mongoose.model('Pieces', piecesSchema);

export default Pieces;
