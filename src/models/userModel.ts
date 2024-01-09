/* eslint-disable no-unused-vars */
// import crypto from 'crypto';
import mongoose from 'mongoose';
import validator from 'validator';
// import bcrypt from 'bcrypt';
import {
  USER_SCHEMA_VALIDATION,
  brandEnum,
  roleEnum,
} from '@src/constants/messages';

interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  brand: string;
  role: string;
  birthday: Date;
  passwordConfirm: string;
  passwordChangedAt: Date;
  resetPasswordToken: string;
  resetPasswordTokenExpiresIn: Date;
  active: boolean;
}

function comparePassword(this: IUser, value: string): boolean {
  return value === this.password;
}

const userSchema = new mongoose.Schema<IUser>({
  firstName: {
    type: String,
    required: [true, USER_SCHEMA_VALIDATION.firstName],
  },
  lastName: {
    type: String,
    required: [true, USER_SCHEMA_VALIDATION.lastName],
  },
  email: {
    type: String,
    unique: true,
    required: [true, USER_SCHEMA_VALIDATION.email],
    lowercase: true,
    validate: [validator.isEmail, USER_SCHEMA_VALIDATION.invalidEmail],
  },
  password: {
    type: String,
    required: [true, USER_SCHEMA_VALIDATION.password],
    minLength: 8,
    select: false,
  },
  phone: {
    type: String,
    required: [true, USER_SCHEMA_VALIDATION.phone],
  },
  brand: {
    type: String,
    required: [true, USER_SCHEMA_VALIDATION.brand],
    enum: brandEnum,
  },
  role: {
    type: String,
    default: roleEnum[1], // default role -> customer
    enum: roleEnum,
  },
  birthday: {
    type: Date,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      message: 'Password do not match',
      validator: comparePassword,
    },
  },
  passwordChangedAt: Date,
  resetPasswordToken: String,
  resetPasswordTokenExpiresIn: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

const User = mongoose.model('User', userSchema);

export default User;
