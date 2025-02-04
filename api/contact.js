import nodemailer from 'nodemailer';
import UAParser from 'ua-parser-js';

// In-memory store for rate limiting (this can be replaced with a database for persistence)
const requestLog = {};

const MAX_REQUESTS = 2;
const BLOCK_TIME = 60 * 1000; // Block for 1 minute

// Function to check and update request counts
const rateLimiter = (ip, browser, device) => {
  const key = `${ip}-${browser}-${device}`;
  
  if (!requestLog[key]) {
    requestLog[key] = {
      count: 1,
      lastRequestTime: Date.now(), 
      blockedUntil: 0 
    };
    return true; // Allow the request
  }

  const { count, lastRequestTime, blockedUntil } = requestLog[key];

  // If block time has passed, reset count
  if (Date.now() - lastRequestTime > BLOCK_TIME) {
    requestLog[key] = {
      count: 1,
      lastRequestTime: Date.now(),
    };
    return true; // Allow the request
  }

  // Check if the count exceeds the max limit
  if (count >= MAX_REQUESTS) {
    return false; // Block the request
  }

  // Increment the request count
  requestLog[key].count += 1;
  return true; // Allow the request
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    // Collect additional information
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || 'No referer';
    const origin = req.headers['origin'] || 'No origin';
    const parser = new UAParser(userAgent);
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();
    const deviceInfo = parser.getDevice();
    const timeOfSubmission = new Date().toISOString();

    // Rate-limiting check
    const isRequestAllowed = rateLimiter(ip, browserInfo.name, deviceInfo.model || 'Unknown Device');
    if (!isRequestAllowed) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    // Set up email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Prepare HTML content for the email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'shankararyal737@gmail.com',
      subject: '📬 New Contact Form Submission',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; border: 1px solid #eee; background-color: #f9f9f9;">
          <h2 style="color: #2b79c2; border-bottom: 2px solid #2b79c2; padding-bottom: 10px;">📧 New Contact Form Submission</h2>
          
          <div style="padding: 10px 0;">
            <p><strong style="color: #333;">Name:</strong> <span style="color: #555;">${name}</span></p>
            <p><strong style="color: #333;">Email:</strong> <span style="color: #555;">${email}</span></p>
            <p><strong style="color: #333;">Message:</strong></p>
            <p style="color: #555; background-color: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
              ${message}
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <h3 style="color: #2b79c2; border-bottom: 2px solid #2b79c2; padding-bottom: 10px;">📋 Additional Information</h3>

          <div style="padding: 10px 0;">
            <p><strong style="color: #333;">IP Address:</strong> <span style="color: #555;">${ip}</span></p>
            <p><strong style="color: #333;">Browser:</strong> <span style="color: #555;">${browserInfo.name} ${browserInfo.version}</span></p>
            <p><strong style="color: #333;">Operating System:</strong> <span style="color: #555;">${osInfo.name} ${osInfo.version}</span></p>
            <p><strong style="color: #333;">Device:</strong> <span style="color: #555;">${deviceInfo.vendor || 'Unknown Vendor'} ${deviceInfo.model || 'Unknown Model'} ${deviceInfo.type || 'Unknown Type'}</span></p>
            <p><strong style="color: #333;">User Agent:</strong> <span style="color: #555;">${userAgent}</span></p>
            <p><strong style="color: #333;">Referer:</strong> <span style="color: #555;">${referer}</span></p>
            <p><strong style="color: #333;">Origin:</strong> <span style="color: #555;">${origin}</span></p>
            <p><strong style="color: #333;">Time of Submission:</strong> <span style="color: #555;">${timeOfSubmission}</span></p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <p style="color: #333; padding: 15px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
            This email contains the detailed information regarding the recent form submission from our website.
          </p>

          <p style="text-align: center; margin-top: 20px;">
            <strong style="color: #2b79c2;">our Website Team -Shankar Aryal</strong><br>
            <a href="https://mrshankararyal.github.io/" style="color: #2b79c2; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      `,
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
