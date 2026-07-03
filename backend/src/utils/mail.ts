import { envs } from "@utils/env";

import NodeMailer from "nodemailer";

const transporter = NodeMailer.createTransport({
  host: envs.MAIL_HOST,
  port: envs.MAIL_PORT,
  secure: false,
  auth: {
    user: envs.MAIL_USER,
    pass: envs.MAIL_PASSWORD,
  },
});

const sendMail = async (to: string, subject: string, text: string) => {
  if (!to || !subject || !text) {
    return { error: "Missing parameters" };
  }

  try {
    const info = await transporter.sendMail({
      from: "UMONS < " + envs.MAIL_USER + ">",
      to,
      subject,
      text,
    });
    return { data: info };
  } catch (error) {
    return { error };
  }
};

export { sendMail };
