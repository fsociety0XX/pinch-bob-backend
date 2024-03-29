import DeliveryMethod from '@src/models/deliveryMethodModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createDeliveryMethod = createOne(DeliveryMethod);
export const updateDeliveryMethod = updateOne(DeliveryMethod);
export const deleteDeliveryMethod = deleteOne(DeliveryMethod);
export const getOneDeliveryMethod = getOne(DeliveryMethod);
export const getAllDeliveryMethod = getAll(DeliveryMethod);
