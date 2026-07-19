const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("VERIFY:", error);
  } else {
    console.log("SMTP READY");
  }
});

module.exports = transporter;