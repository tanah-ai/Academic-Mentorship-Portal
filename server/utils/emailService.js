const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send registration email
const sendRegistrationEmail = async (email, firstName, lastName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"MSU Mentorship Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to MSU Academic Mentorship Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to MSU Mentorship Portal!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Dear <strong>${firstName} ${lastName}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Welcome to the MSU Academic Mentorship Portal! We're thrilled to have you join our community of learners and mentors.
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Your account has been successfully created. You can now:
            </p>
            <ul style="font-size: 16px; color: #374151; line-height: 1.6; padding-left: 20px;">
              <li>Find mentors to help you with your studies</li>
              <li>Share your knowledge by becoming a mentor</li>
              <li>Track your progress and earn badges</li>
              <li>Connect with fellow students</li>
            </ul>
            <p style="font-size: 16px; color: #374151; line-height: 1.6; margin-top: 20px;">
              To get started, simply log in to your account and explore the dashboard.
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Your Account</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              If you have any questions, feel free to contact us at support@msu.ac.zw
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send session booking email to mentor
const sendSessionBookingEmailToMentor = async (mentorEmail, mentorName, menteeName, moduleCode, sessionTitle, scheduledDate) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"MSU Mentorship Portal" <${process.env.EMAIL_USER}>`,
      to: mentorEmail,
      subject: `New Session Request: ${moduleCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">New Session Request!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Dear <strong>${mentorName}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              You have received a new mentorship session request from <strong>${menteeName}</strong>.
            </p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3 style="color: #065f46; margin: 0 0 10px 0;">Session Details:</h3>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Module:</strong> ${moduleCode}</p>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Topic:</strong> ${sessionTitle}</p>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Scheduled:</strong> ${new Date(scheduledDate).toLocaleString()}</p>
            </div>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Please log in to your dashboard to accept or decline this session request.
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/sessions" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Session Requests</a>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send session started email to mentee
const sendSessionStartedEmailToMentee = async (menteeEmail, menteeName, mentorName, moduleCode, sessionTitle, meetingLink) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"MSU Mentorship Portal" <${process.env.EMAIL_USER}>`,
      to: menteeEmail,
      subject: `Your Session Has Started: ${moduleCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Your Session Has Started!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Dear <strong>${menteeName}</strong>,
            </p>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Your mentorship session with <strong>${mentorName}</strong> has started!
            </p>
            <div style="background: #f3e8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
              <h3 style="color: #5b21b6; margin: 0 0 10px 0;">Session Details:</h3>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Module:</strong> ${moduleCode}</p>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Topic:</strong> ${sessionTitle}</p>
              <p style="font-size: 15px; color: #374151; margin: 5px 0;"><strong>Mentor:</strong> ${mentorName}</p>
            </div>
            ${meetingLink ? `
            <div style="text-align: center; margin-top: 30px;">
              <a href="${meetingLink}" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Join Session Now</a>
            </div>
            ` : ''}
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
              If you have any issues joining the session, please contact your mentor or support.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRegistrationEmail,
  sendSessionBookingEmailToMentor,
  sendSessionStartedEmailToMentee
};
