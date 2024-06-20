import mongoose from 'mongoose';
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import User from '@src/models/userModel';
import { generateOrderId } from '@src/utils/functions';
import CustomiseCake from '@src/models/customiseCakeModel';
import Address from '@src/models/addressModel';

// eslint-disable-next-line import/prefer-default-export
export const submitCustomerForm = catchAsync(
  async (req: Request, res: Response) => {
    const {
      email,
      firstName,
      lastName,
      phone,
      brand,
      delivery: {
        address: { city, country, address1, address2, postalCode },
      },
    } = req.body;

    // creating user
    const newUser = {
      email,
      firstName,
      lastName,
      phone,
    };
    const filter = { email };
    const update = { $setOnInsert: newUser };
    const options = { upsert: true, returnOriginal: false };
    const result = await User.findOneAndUpdate(filter, update, options);

    // creating address
    const newAddress = {
      brand,
      firstName,
      lastName,
      city,
      country,
      address1,
      address2,
      postalCode,
      phone,
      user: new mongoose.Types.ObjectId(result!._id),
    };
    const createdAddress = await Address.create(newAddress);

    req.body.user = result?._id;
    req.body.delivery.address = createdAddress._id;
    req.body.orderNumber = generateOrderId();
    if (req.files?.length) {
      req.body.images = req.files;
    }

    const doc = await CustomiseCake.create(req.body);
    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);
