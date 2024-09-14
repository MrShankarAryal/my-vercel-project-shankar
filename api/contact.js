import nodemailer from 'nodemailer';

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
        pass: process.env.EMAIL_PASS
      }
    });

    // Email message details
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'shankararyal737@gmail.com',
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}\nIP Address: ${ip}`
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: 'Form submission successful.\n When you submitted you also give IP Address to us.\n If any voilence notice we will be sitting in your home.\n Thank you please be back to website' });
    } catch (error) {
      res.status(500).json({ message: 'Error sending email' });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
