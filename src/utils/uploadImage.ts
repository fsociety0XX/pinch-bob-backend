import dotenv from 'dotenv-safe';
import multer, { FileFilterCallback, Multer } from 'multer';
import multerS3 from 'multer-s3';
import { Express } from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { IMAGE_FILE_TYPE_VALIDATION } from '@src/constants/messages';
import AppError from './appError';
import { StatusCode } from '@src/types/customTypes';
import { IMAGE_SIZE_LIMIT } from '@src/constants/static';

dotenv.config({ path: './.env' });

// s3 instance using S3Client
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SCERET_KEY!,
  },
  region: process.env.AWS_S3_REGION,
});

const s3Storage = (destinationPath: string) =>
  multerS3({
    s3,
    bucket: process.env.AWS_BUCKET!,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { fieldname: file.fieldname });
    },
    key: (req, file, cb) => {
      const fileName = `${file.originalname}_${Date.now()}`;
      cb(null, `${destinationPath}/${fileName}`);
    },
  });

// sanitize files and send error for unsupported files
function sanitizeFile(file: Express.Multer.File, cb: FileFilterCallback) {
  const isAllowedMimeType = file.mimetype.startsWith('image/');
  if (isAllowedMimeType) {
    return cb(null, true);
  }
  return cb(new AppError(IMAGE_FILE_TYPE_VALIDATION, StatusCode.BAD_REQUEST));
}

const uploadImage = (destinationPath: string): Multer =>
  multer({
    storage: s3Storage(destinationPath),
    fileFilter: (req, file, callback) => {
      sanitizeFile(file, callback);
    },
    limits: {
      fileSize: IMAGE_SIZE_LIMIT,
    },
  });

export default uploadImage;
