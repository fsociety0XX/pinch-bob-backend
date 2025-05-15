import dotenv from 'dotenv-safe';
import twilio from 'twilio';
import { formatPhoneNumber } from './functions';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSms = async (body: string, phone: string): Promise<void> => {
  const phoneNumber = formatPhoneNumber(phone);

  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  });
};

export default sendSms;
