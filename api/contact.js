import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import UAParser from 'ua-parser-js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import xss from 'xss';
import { validate } from 'email-validator';

// Initialize SES client
const sesClient = new SESClient({ region: process.env.AWS_REGION });

// Initialize UAParser
const parser = new UAParser();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
});

// Middleware setup
const setupMiddleware = (req, res) => {
  helmet()(req, res, () => {});
  limiter(req, res, () => {});
};

// Sanitize input
const sanitizeInput = (input) => xss(input);

export default async function handler(req, res) {
  setupMiddleware(req, res);

  // Set secure headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Input validation and sanitization
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!validate(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    const sanitizedName = sanitizeInput(name);
    const sanitizedMessage = sanitizeInput(message);

    // Collect additional information
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || 'No referer';
    const origin = req.headers['origin'] || 'No origin';
    
    // Parse user agent asynchronously
    const parseUserAgent = async () => {
      const result = parser.setUA(userAgent).getResult();
      return {
        browser: `${result.browser.name} ${result.browser.version}`,
        os: `${result.os.name} ${result.os.version}`,
        device: `${result.device.vendor || 'Unknown Vendor'} ${result.device.model || 'Unknown Model'} ${result.device.type || 'Unknown Type'}`
      };
    };

    // Generate email content
    const generateEmailContent = async () => {
      const { browser, os, device } = await parseUserAgent();
      const timeOfSubmission = new Date().toISOString();

      return `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; border: 1px solid #eee; background-color: #f9f9f9;">
          <h2 style="color: #2b79c2; border-bottom: 2px solid #2b79c2; padding-bottom: 10px;">📧 New Contact Form Submission</h2>
          
          <div style="padding: 10px 0;">
            <p><strong style="color: #333;">Name:</strong> <span style="color: #555;">${sanitizedName}</span></p>
            <p><strong style="color: #333;">Email:</strong> <span style="color: #555;">${email}</span></p>
            <p><strong style="color: #333;">Message:</strong></p>
            <p style="color: #555; background-color: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
              ${sanitizedMessage}
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <h3 style="color: #2b79c2; border-bottom: 2px solid #2b79c2; padding-bottom: 10px;">📋 Additional Information</h3>

          <div style="padding: 10px 0;">
            <p><strong style="color: #333;">IP Address:</strong> <span style="color: #555;">${ip}</span></p>
            <p><strong style="color: #333;">Browser:</strong> <span style="color: #555;">${browser}</span></p>
            <p><strong style="color: #333;">Operating System:</strong> <span style="color: #555;">${os}</span></p>
            <p><strong style="color: #333;">Device:</strong> <span style="color: #555;">${device}</span></p>
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
            <strong style="color: #2b79c2;">Our Website Team - Shankar Aryal</strong><br>
            <a href="https://mrshankararyal.github.io/" style="color: #2b79c2; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      `;
    };

    try {
      console.log('Preparing email content...');
      const emailContent = await generateEmailContent();

      console.log('Sending email...');
      const params = {
        Destination: {
          ToAddresses: [process.env.RECIPIENT_EMAIL],
        },
        Message: {
          Body: {
            Html: { Data: emailContent },
          },
          Subject: { Data: "📬 New Contact Form Submission" },
        },
        Source: process.env.SENDER_EMAIL,
      };

      // Ensure SENDER_EMAIL is set
      if (!process.env.SENDER_EMAIL) {
        throw new Error('SENDER_EMAIL environment variable is not set');
      }

      const command = new SendEmailCommand(params);
      await sesClient.send(command);

      console.log('Email sent successfully.');
      res.status(200).json({
        message: 'Form submission successful. Thank you for your message.',
      });
    } catch (error) {
      console.error('Error processing request:', error.message);
      res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
