const nodemailer = require("nodemailer");

const sendEmailForgot = async (email, subject, resetLink) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
      logger: true,
    });

    transporter.verify(function (error, success) {
      if (error) {
        console.log(error);
      }
    });

    const capitalizedName =
      process.env.DATABASE_NAME.charAt(0).toUpperCase() +
      process.env.DATABASE_NAME.slice(1);

    let html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Reset Your Password</title>
    <style>
      @media only screen and (max-width: 620px) {
        table.body h1 {
          font-size: 28px !important;
          margin-bottom: 10px !important;
        }
        table.body p,
        table.body ul,
        table.body ol,
        table.body td,
        table.body span,
        table.body a {
          font-size: 16px !important;
        }
        table.body .wrapper,
        table.body .article {
          padding: 10px !important;
        }
        table.body .content {
          padding: 0 !important;
        }
        table.body .container {
          padding: 0 !important;
          width: 100% !important;
        }
        table.body .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
        table.body .btn table {
          width: 100% !important;
        }
        table.body .btn a {
          width: 100% !important;
        }
        table.body .img-responsive {
          height: auto !important;
          max-width: 100% !important;
          width: auto !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
        .btn-primary table td:hover {
          background-color: #E97C00 !important;
        }
        .btn-primary a:hover {
          background-color: #E97C00 !important;
          border-color: #E97C00 !important;
        }
      }
    </style>
  </head>
  <body style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0;">
    <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; visibility: hidden; width: 0;">Reset your password for ${capitalizedName}</span>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" width="100%" bgcolor="#f6f6f6">
      <tr>
        <td>&nbsp;</td>
        <td class="container" width="580" style="display: block; max-width: 580px; margin: 0 auto; padding: 10px;">
          <div class="content" style="max-width: 580px; margin: 0 auto; padding: 10px; background: #ffffff; border-radius: 3px;">
            
            <table role="presentation" width="100%" style="background: #ffffff; border-radius: 3px;">
              <tr>
                <td style="padding: 20px; font-family: sans-serif; font-size: 14px; line-height: 1.4; color: #000;">
                  <p>Hi ${email},</p>
                  <p>You recently requested to reset your password for <strong>${capitalizedName}</strong>. Click the button below to reset it. This password reset link is valid for the next <strong>10 minutes</strong>.</p>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" width="100%">
                    <tbody>
                      <tr>
                        <td align="center" bgcolor="#E97C00" style="border-radius: 5px;">
                          <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 25px; font-weight: bold; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
                  <p>Thank you,<br/>The ${capitalizedName} Team</p>
                </td>
              </tr>
            </table>

          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`;

    const mailOptions = {
      from: `${capitalizedName} Support <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      text: resetLink,
      html: html,
    };

    await transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Send mail error:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });
  } catch (error) {
    console.log("Error sending reset password mail:", error);
  }
};

module.exports = sendEmailForgot;
