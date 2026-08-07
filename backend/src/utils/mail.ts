import { envs } from "@utils/env";

import NodeMailer from "nodemailer";

// `secure: false` codé en dur alors que MAIL_PORT vaut 465 par défaut : le 465
// exige un TLS implicite dès la connexion. En clair, les identifiants SMTP
// pouvaient partir en clair si le serveur n'annonçait pas STARTTLS.
// -> TLS implicite sur 465, STARTTLS EXIGÉ (et non plus opportuniste) ailleurs.
const useImplicitTls = Number(envs.MAIL_PORT) === 465;

const transporter = NodeMailer.createTransport({
  host: envs.MAIL_HOST,
  port: envs.MAIL_PORT,
  secure: useImplicitTls,
  requireTLS: !useImplicitTls,
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
