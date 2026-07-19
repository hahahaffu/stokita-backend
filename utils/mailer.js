const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,

  tls: {
    rejectUnauthorized: false,
  },

  family: 4,
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("VERIFY ERROR:", error);
  } else {
    console.log("SMTP SERVER READY");
  }
});

module.exports = transporter;