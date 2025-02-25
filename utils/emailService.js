const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const nodemailer = require("nodemailer");

// Configure the transporter (Using Gmail SMTP as an example)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.APP_EMAIL, // Your email
    pass: process.env.APP_PASSWORD  // App password (Enable 2FA and create an App password in Gmail)
  }
});

const sendInventoryAlert = async (agencyEmail, agencyName, currentCapacity, totalCapacity) => {
  const mailOptions = {
    from: process.env.APP_EMAIL,
    to: agencyEmail,
    subject: "⚠ Inventory Alert: 90% Capacity Reached",
    html: `
      <h2>Inventory Alert</h2>
      <p>Dear ${agencyName},</p>
      <p>Your inventory is now at <strong>${currentCapacity}/${totalCapacity} (90% full)</strong>.</p>
      <p>Please take necessary actions to free up space.</p>
      <br>
      <p>Best regards,</p>
      <p><strong>Avakara E-Waste Platform</strong></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email alert sent to ${agencyEmail}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};



module.exports = sendInventoryAlert;