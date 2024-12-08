
import nodemailer from 'nodemailer';
import UAParser from 'ua-parser-js';
import rateLimit from 'express-rate-limit';

// In-memory storage for tracking IP attempts
const ipAttempts = new Map();
const blockedIPs = new Set();

// Rate limiting configuration
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests, please try again later',
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    blockIP(ip);
    res.status(429).json({ 
      message: 'Too many requests. IP has been temporarily blocked.',
      blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
});

// IP blocking mechanism
function blockIP(ip) {
  blockedIPs.add(ip);
  
  // Automatically unblock after 24 hours
  setTimeout(() => {
    blockedIPs.delete(ip);
    ipAttempts.delete(ip);
  }, 24 * 60 * 60 * 1000);
}

// Advanced request validation
function validateRequest(req) {
  const { name, email, message } = req.body;

  // Comprehensive validation checks
  const validationRules = [
    // Check for empty or whitespace-only fields
    () => name && name.trim().length > 0,
    () => email && email.trim().length > 0,
    () => message && message.trim().length > 0,

    // Email format validation
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

    // Prevent potential injection or spam
    () => {
      const suspiciousPatterns = [
        /<script>/i,
        /javascript:/i,
        /onclick=/i,
        /alert\(/i,
        /\b(test|hack|spam)\b/i
      ];

      return !suspiciousPatterns.some(pattern => 
        pattern.test(name) || 
        pattern.test(email) || 
        pattern.test(message)
      );
    },

    // Length restrictions
    () => name.length <= 50,
    () => email.length <= 100,
    () => message.length <= 500
  ];

  return validationRules.every(rule => rule());
}

// Logging mechanism
function logSecurityEvent(type, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    ...details
  };
  
  console.log(JSON.stringify(logEntry));
  // In a production scenario, you might want to log to a file or database
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // IP tracking and blocking
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    logSecurityEvent('IP_BLOCKED', { ip });
    return res.status(403).json({ 
      message: 'Access denied. Your IP is temporarily blocked.',
      blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Apply rate limiting
  await contactLimiter(req, res);

  if (req.method === 'POST') {
    // Validate request
    if (!validateRequest(req)) {
      logSecurityEvent('INVALID_REQUEST', { 
        ip, 
        body: req.body 
      });
      return res.status(400).json({ message: 'Invalid request data' });
    }

    const { name, email, message } = req.body;

    // Collect additional information
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || 'No referer';
    const origin = req.headers['origin'] || 'No origin';
    const parser = new UAParser(userAgent);
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();
    const deviceInfo = parser.getDevice();
    const timeOfSubmission = new Date().toISOString();

    // Track and limit attempts per IP
    const attempts = (ipAttempts.get(ip) || 0) + 1;
    ipAttempts.set(ip, attempts);

    // Block IP if too many attempts
    if (attempts > 10) {
      blockIP(ip);
      logSecurityEvent('IP_AUTO_BLOCKED', { 
        ip, 
        attemptCount: attempts 
      });
      return res.status(403).json({ 
        message: 'Too many attempts. IP blocked.',
        blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Set up email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Additional security for email
      secure: true,
      requireTLS: true
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
        </div>
      `,
    };

    try {
      // Send email
      await transporter.sendMail(mailOptions);

      // Log successful submission
      logSecurityEvent('SUBMISSION_SUCCESS', { 
        ip, 
        email,
        attemptCount: attempts 
      });

      res.status(200).json({
        message: 'Form submission successful. Thank you for your message.',
      });
    } catch (error) {
      // Log email sending error
      logSecurityEvent('EMAIL_SEND_FAILURE', { 
        ip, 
        errorMessage: error.message 
      });

      res.status(500).json({ message: 'Error sending email' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
