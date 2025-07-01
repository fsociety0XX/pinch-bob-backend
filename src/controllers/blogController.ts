import Blog from '@src/models/blogModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createBlog = createOne(Blog);
export const updateBlog = updateOne(Blog);
export const deleteBlog = deleteOne(Blog);
export const getOneBlog = getOne(Blog);
export const getAllBlog = getAll(Blog);
