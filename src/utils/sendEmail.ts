import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import path from 'path';
import { TEMPLATES_DIR } from '@src/constants/messages';

interface IEmail {
  email: string;
  subject: string;
  template?: string;
  context?: { [key: string]: string };
  brand: string;
}

const sendEmail = async ({
  email,
  subject,
  template,
  context,
  brand,
}: IEmail): Promise<void> => {
  // Validate email before attempting to send
  if (
    !email ||
    typeof email !== 'string' ||
    !email.trim() ||
    !email.includes('@')
  ) {
    console.warn(`Invalid email provided to sendEmail: ${email}`);
    throw new Error('Invalid email address provided');
  }

  const validEmail = email.trim();

  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: +process.env.EMAIL_PORT!,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASS,
    },
  });

  transport.use(
    'compile',
    hbs({
      viewEngine: {
        extname: '.hbs',
        layoutsDir: path.resolve(TEMPLATES_DIR, brand),
        defaultLayout: false,
        helpers: {
          ternaryDeliveryType: (
            deliveryMethod: string,
            option1: string,
            option2: string
          ) => {
            return deliveryMethod === 'Self-collect' ? option1 : option2; // Self collect ternary condition for order confirmation email
          },
        },
      },
      viewPath: path.resolve(TEMPLATES_DIR, brand),
      extName: '.hbs',
    })
  );

  const mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: validEmail,
    subject,
    template,
    context,
  };
  await transport.sendMail(mailOptions);
};

export default sendEmail;
