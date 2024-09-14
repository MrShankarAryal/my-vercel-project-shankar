import nodemailer from 'nodemailer';

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
      console.log('Sending email...');
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully.');
      
      res.status(200).json({
        message: 'Form submission successful.\n When you submitted you also gave us your IP Address.\n If any violence is noticed, we will be at your home.\n Thank you and please come back to the website.',
      });
    } catch (error) {
      console.error('Error sending email:', error.message);
      res.status(500).json({ message: 'Error sending email' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
