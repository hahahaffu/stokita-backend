const axios = require("axios");

const sendVerificationEmail = async ({
    to,
    name,
    subject,
    html,
}) => {
    try {
        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Stokita",
                    email: process.env.MAIL_FROM_EMAIL,
                },

                to: [
                    {
                        email: to,
                        name,
                    },
                ],

                subject,

                htmlContent: html,
            },
            {
                headers: {
                    accept: "application/json",
                    "api-key": process.env.BREVO_API_KEY,
                    "content-type": "application/json",
                },
            }
        );

        return response.data;
    } catch (err) {
        console.error(
            "BREVO ERROR:",
            err.response?.data || err.message
        );

        throw err;
    }
};

module.exports = sendVerificationEmail;