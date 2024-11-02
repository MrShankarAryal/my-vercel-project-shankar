// api/booking.js
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import UAParser from 'ua-parser-js';

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'shankararyal737@gmail.com',
    pass: process.env.EMAIL_PASS || 'bvoa aojz oxjb kpng'
  }
});

// In-memory store for verification codes (replace with proper database in production)
const verificationStore = new Map();

// Utility functions
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const isValidWhatsAppNumber = (number) => {
  const pattern = /^\+?[1-9]\d{1,14}$/;
  return pattern.test(number);
};

const isValidGoogleChatId = (id) => {
  return id.includes('@') && id.length > 5;
};

// WhatsApp verification using WhatsApp Cloud API
const sendWhatsAppVerification = async (phoneNumber, code) => {
  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: 'verification_code',
          language: {
            code: 'en'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: code
                }
              ]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      throw new Error('WhatsApp API request failed');
    }

    return true;
  } catch (error) {
    console.error('WhatsApp verification error:', error);
    throw new Error('Failed to send WhatsApp verification');
  }
};

// Google Chat verification
const sendGoogleChatVerification = async (chatId, code) => {
  try {
    const response = await fetch(`https://chat.googleapis.com/v1/spaces/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_CHAT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `Your verification code is: ${code}. Valid for 10 minutes.`
      })
    });

    if (!response.ok) {
      throw new Error('Google Chat API request failed');
    }

    return true;
  } catch (error) {
    console.error('Google Chat verification error:', error);
    throw new Error('Failed to send Google Chat verification');
  }
};

// Vercel API Routes

// POST /api/verify
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contactMethod, contactId, name, email } = req.body;

    // Basic validation
    if (!contactMethod || !contactId || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Contact method validation
    if (contactMethod === 'whatsapp' && !isValidWhatsAppNumber(contactId)) {
      return res.status(400).json({ error: 'Invalid WhatsApp number' });
    } else if (contactMethod === 'googleChat' && !isValidGoogleChatId(contactId)) {
      return res.status(400).json({ error: 'Invalid Google Chat ID' });
    }

    // Check for existing verification attempts
    const existingVerification = verificationStore.get(contactId);
    if (existingVerification && existingVerification.attempts >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts' });
    }

    // Generate and store verification code
    const code = generateVerificationCode();
    const verificationData = {
      code,
      attempts: existingVerification ? existingVerification.attempts + 1 : 1,
      timestamp: Date.now(),
      verified: false,
      contactMethod,
      name,
      email
    };
    verificationStore.set(contactId, verificationData);

    // Send verification code
    if (contactMethod === 'whatsapp') {
      await sendWhatsAppVerification(contactId, code);
    } else {
      await sendGoogleChatVerification(contactId, code);
    }

    return res.status(200).json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
}

// POST /api/verify/confirm
export async function confirmVerification(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contactId, code } = req.body;

    const verification = verificationStore.get(contactId);
    if (!verification) {
      return res.status(400).json({ error: 'No verification found' });
    }

    // Check expiration (10 minutes)
    if (Date.now() - verification.timestamp > 10 * 60 * 1000) {
      verificationStore.delete(contactId);
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (verification.code !== code) {
      verification.attempts += 1;
      if (verification.attempts >= 3) {
        verificationStore.delete(contactId);
        return res.status(429).json({ error: 'Too many attempts' });
      }
      return res.status(400).json({ error: 'Invalid code' });
    }

    verification.verified = true;
    verificationStore.set(contactId, verification);

    return res.status(200).json({ message: 'Verification successful' });
  } catch (error) {
    console.error('Verification confirmation error:', error);
    return res.status(500).json({ error: 'Verification confirmation failed' });
  }
}

// POST /api/book
export async function bookAppointment(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contactId, date, time } = req.body;

    // Get verification data
    const verification = verificationStore.get(contactId);
    if (!verification || !verification.verified) {
      return res.status(400).json({ error: 'Contact not verified' });
    }

    // Parse user agent for additional security
    const parser = new UAParser(req.headers['user-agent']);
    const userAgent = parser.getResult();

    // Send confirmation emails
    const userEmail = {
      from: process.env.EMAIL_USER,
      to: verification.email,
      subject: 'Appointment Confirmation',
      html: `
        <h2>Appointment Confirmed</h2>
        <p>Dear ${verification.name},</p>
        <p>Your appointment has been scheduled for ${date} at ${time}.</p>
        <p>We'll send you a reminder 15 minutes before the appointment.</p>
      `
    };

    const adminEmail = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'New Appointment Booking',
      html: `
        <h2>New Appointment</h2>
        <p>Name: ${verification.name}</p>
        <p>Email: ${verification.email}</p>
        <p>Contact: ${verification.contactMethod} - ${contactId}</p>
        <p>Date: ${date}</p>
        <p>Time: ${time}</p>
        <p>Browser: ${userAgent.browser.name} ${userAgent.browser.version}</p>
        <p>OS: ${userAgent.os.name} ${userAgent.os.version}</p>
      `
    };

    await transporter.sendMail(userEmail);
    await transporter.sendMail(adminEmail);

    // Clear verification data
    verificationStore.delete(contactId);

    return res.status(200).json({ message: 'Appointment booked successfully' });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Booking failed' });
  }
}
