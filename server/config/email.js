const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send session start notification to mentee
const sendSessionStartEmail = async (menteeEmail, menteeName, mentorName, sessionTitle, sessionLink, scheduledDate) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"MSU Mentorship Portal" <noreply@msu.ac.zw>',
    to: menteeEmail,
    subject: `Session Started: ${sessionTitle} with ${mentorName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MSU Academic Mentorship Portal</h1>
          </div>
          <div class="content">
            <h2>Your Session Has Started!</h2>
            <p>Dear ${menteeName},</p>
            <p>Your mentor <strong>${mentorName}</strong> has started the session:</p>
            <p><strong>Session:</strong> ${sessionTitle}</p>
            <p><strong>Scheduled:</strong> ${new Date(scheduledDate).toLocaleString()}</p>
            <p>Please join the virtual workspace to begin your mentoring session.</p>
            <a href="${process.env.CLIENT_URL}${sessionLink}" class="button">Join Session Now</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${process.env.CLIENT_URL}${sessionLink}</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2024 MSU Academic Mentorship Portal</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Session start email sent to ${menteeEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending session start email:', error);
    return false;
  }
};

// Send session reminder email
const sendSessionReminderEmail = async (menteeEmail, menteeName, mentorName, sessionTitle, scheduledDate, sessionLink) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"MSU Mentorship Portal" <noreply@msu.ac.zw>',
    to: menteeEmail,
    subject: `Reminder: Upcoming Session - ${sessionTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MSU Academic Mentorship Portal</h1>
          </div>
          <div class="content">
            <h2>Session Reminder</h2>
            <p>Dear ${menteeName},</p>
            <p>This is a reminder about your upcoming session with <strong>${mentorName}</strong>:</p>
            <p><strong>Session:</strong> ${sessionTitle}</p>
            <p><strong>Scheduled:</strong> ${new Date(scheduledDate).toLocaleString()}</p>
            <p>Please be ready to join on time.</p>
            <a href="${process.env.CLIENT_URL}${sessionLink}" class="button">View Session</a>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2024 MSU Academic Mentorship Portal</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Session reminder email sent to ${menteeEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending session reminder email:', error);
    return false;
  }
};

module.exports = {
  sendSessionStartEmail,
  sendSessionReminderEmail
};
