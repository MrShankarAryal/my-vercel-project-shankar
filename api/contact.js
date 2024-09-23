import nodemailer from 'nodemailer';
import UAParser from 'ua-parser-js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    // Collect additional information
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const parser = new UAParser(userAgent);
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();
    const deviceInfo = parser.getDevice();

    // Set up the email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Prepare additional information
    const additionalInfo = `
IP Address: ${ip}
Browser: ${browserInfo.name} ${browserInfo.version}
Operating System: ${osInfo.name} ${osInfo.version}
Device: ${deviceInfo.vendor} ${deviceInfo.model} ${deviceInfo.type}
User Agent: ${userAgent}
    `;

    // Email message details
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'shankararyal737@gmail.com',
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}\n\nAdditional Information:\n${additionalInfo}`,
    };

    try {
      console.log('Sending email...');
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully.');
      
      res.status(200).json({
        message: 'Form submission successful. Thank you for your message.',
      });
    } catch (error) {
      console.error('Error sending email:', error.message);
      res.status(500).json({ message: 'Error sending email' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
