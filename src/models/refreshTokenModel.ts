import mongoose, { Document, model } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  user: mongoose.Schema.Types.ObjectId;
  expiresAt: Date;
  isRevoked: boolean;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    deviceId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      deviceId: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
refreshTokenSchema.index({ user: 1, isRevoked: 1 });
refreshTokenSchema.index({ token: 1, isRevoked: 1 });

// Clean up revoked tokens periodically
refreshTokenSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 90, // 90 days
    partialFilterExpression: { isRevoked: true },
  }
);

const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
