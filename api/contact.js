import nodemailer from 'nodemailer';
import UAParser from 'ua-parser-js';
import validator from 'validator';

// Enhanced rate limiting with persistent storage recommendation
const requestLog = new Map();
const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute window

const rateLimiter = (ip, userAgent) => {
  const now = Date.now();
  const key = `${ip}_${userAgent}`;

  if (!requestLog.has(key)) {
    requestLog.set(key, { count: 1, firstRequest: now });
    return true;
  }

  const entry = requestLog.get(key);
  
  // Reset counter if window has passed
  if (now - entry.firstRequest > WINDOW_MS) {
    requestLog.set(key, { count: 1, firstRequest: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
};

export default async function handler(req, res) {
  // Secure CORS configuration (update origin to your domain)
  res.setHeader('Access-Control-Allow-Origin', 'https://shankararyal404.com.np');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const { name, email, message } = req.body;

      // Input validation
      if (!name || !email || !message) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (!validator.isEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Sanitize inputs
      const cleanName = validator.escape(name);
      const cleanEmail = validator.normalizeEmail(email);
      const cleanMessage = validator.escape(message);

      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Client information gathering
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const referer = req.headers['referer'] || 'Direct access';
      const origin = req.headers['origin'] || 'Unknown origin';
      
      // Enhanced UA parsing
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();
      const engine = parser.getEngine();
      
      // Rate limiting with IP + UA combination
      if (!rateLimiter(ip, userAgent)) {
        console.warn(`Rate limit exceeded for ${ip} - ${userAgent}`);
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      // Email configuration with improved security
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        secure: true,
        tls: {
          rejectUnauthorized: true,
        },
      });

      // Enhanced email template with security considerations
      const mailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto;">
          <h2 style="color: #2b79c2;">📨 New Contact Form Submission</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h3>📝 User Information</h3>
            <p><strong>Name:</strong> ${cleanName}</p>
            <p><strong>Email:</strong> ${cleanEmail}</p>
            <p><strong>Message:</strong><br>${cleanMessage.replace(/\n/g, '<br>')}</p>
          </div>

          <div style="margin-top: 20px; background: #fff; padding: 20px; border-radius: 8px;">
            <h3>🔍 Technical Details</h3>
            <p><strong>IP Address:</strong> ${ip}</p>
            <p><strong>Browser:</strong> ${browser.name} ${browser.version}</p>
            <p><strong>OS:</strong> ${os.name} ${os.version}</p>
            <p><strong>Device:</strong> ${device.vendor || 'Unknown'} ${device.model || 'Unknown'} (${device.type || 'Unknown'})</p>
            <p><strong>Engine:</strong> ${engine.name} ${engine.version}</p>
            <p><strong>Referrer:</strong> ${referer}</p>
            <p><strong>Origin:</strong> ${origin}</p>
            <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="margin-top: 20px; text-align: center; color: #666;">
            <p>🔒 This message was sent securely from your website contact form</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Website Security" <${process.env.EMAIL_USER}>`,
        to: process.env.RECIPIENT_EMAIL,
        subject: '🔐 New Secure Form Submission',
        html: mailContent,
      });

      res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
