import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

// Function to send a push notification
const sendPushNotification = async (title, message) => {
  const response = await fetch('https://api.pushbullet.com/v2/pushes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': process.env.PUSHBULLET_ACCESS_TOKEN, // Add your Pushbullet access token here
    },
    body: JSON.stringify({
      type: 'note',
      title: title,
      body: message,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send push notification');
  }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    // Collect the IP address
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Set up the email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email message details
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'shankararyal737@gmail.com',
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}\nIP Address: ${ip}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      // Send push notification on success
      await sendPushNotification(
        'Form Submission Success',
        `Form submission successful.\nName: ${name}\nEmail: ${email}\nMessage: ${message}\nIP Address: ${ip}`
      );
      res.status(200).json({
        message: 'Form submission successful.\n When you submitted you also gave us your IP Address.\n If any violence is noticed, we will be at your home.\n Thank you and please come back to the website.',
      });
    } catch (error) {
      // Send push notification on error
      await sendPushNotification('Form Submission Error', 'Error sending email');
      res.status(500).json({ message: 'Error sending email' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
