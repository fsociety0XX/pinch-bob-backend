import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import path from 'path';
import { TEMPLATES_DIR } from '@src/constants/messages';

interface IEmail {
  email: string;
  subject: string;
  template?: string;
  context?: { [key: string]: string };
}

const sendEmail = async ({
  email,
  subject,
  template,
  context,
}: IEmail): Promise<void> => {
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
        layoutsDir: path.resolve(TEMPLATES_DIR),
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
      viewPath: path.resolve(TEMPLATES_DIR),
      extName: '.hbs',
    })
  );

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject,
    template,
    context,
  };
  await transport.sendMail(mailOptions);
};

export default sendEmail;
