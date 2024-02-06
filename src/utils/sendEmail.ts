import nodemailer from 'nodemailer';

interface IEmail {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async ({
  email,
  subject,
  message,
}: IEmail): Promise<void> => {
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: +process.env.EMAIL_PORT!,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject,
    text: message,
  };

  await transport.sendMail(mailOptions);
};

export default sendEmail;
