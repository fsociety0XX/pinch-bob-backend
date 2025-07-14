// models/activityLogModel.ts
import { Schema, Document, model } from 'mongoose';

interface IUserSnapshot {
  _id: string;
  name: string;
  email: string;
}

export interface IActivityLog extends Document {
  user: IUserSnapshot;
  action: string;
  module: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  brand?: string;
  timestamp: Date;
}

const userSnapshotSchema = new Schema<IUserSnapshot>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: userSnapshotSchema, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    targetId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    brand: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);

export default ActivityLog;
