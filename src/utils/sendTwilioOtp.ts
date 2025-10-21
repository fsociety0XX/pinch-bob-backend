import dotenv from 'dotenv-safe';
import twilio from 'twilio';
import { formatPhoneNumber } from './functions';
import { isPhoneNumberBlocked } from '../constants/static';
import AppError from './appError';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSms = async (body: string, phone: string): Promise<void> => {
  // Check if phone number is blocked
  if (isPhoneNumberBlocked(phone)) {
    throw new AppError('This phone number is blocked.', 400);
  }

  const phoneNumber = formatPhoneNumber(phone);

  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  });
};

export default sendSms;
