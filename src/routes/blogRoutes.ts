import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import uploadImage from '@src/utils/uploadImage';
import {
  createBlog,
  deleteBlog,
  getAllBlog,
  getOneBlog,
  updateBlog,
} from '@src/controllers/blogController';

const blogRouter = express.Router();

blogRouter.route('/').get(getAllBlog); // No protection for get all data

blogRouter.use(protect, roleRistriction(Role.ADMIN));
blogRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).array('images', 20),
    createBlog
  );

blogRouter
  .route('/:id')
  .get(getOneBlog)
  .patch(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).array('images', 20),
    updateBlog
  )
  .delete(deleteBlog);

export default blogRouter;
