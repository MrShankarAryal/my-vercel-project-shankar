// Base API URL
const apiUrl = '/api/appointment';

// Elements from the DOM
const contactForm = document.getElementById('contactForm');
const verifyForm = document.getElementById('verifyForm');
const bookingForm = document.getElementById('bookingForm');

// Function to initiate verification via chosen method (WhatsApp or Google Chat)
async function initiateVerification(contactMethod, contactId, name, email) {
  try {
    const response = await fetch(`${apiUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactMethod,
        contactId,
        name,
        email,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message || 'Verification code sent successfully.');
      // Optionally, show the verification form here for user to enter code
      verifyForm.style.display = 'block';
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Verification initiation error:', error);
    alert('Failed to send verification code. Please try again.');
  }
}

// Function to confirm the verification code
async function confirmVerificationCode(contactId, code) {
  try {
    const response = await fetch(`${apiUrl}/verify/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactId,
        code,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message || 'Verification successful.');
      // Optionally, show the booking form here after successful verification
      bookingForm.style.display = 'block';
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Verification confirmation error:', error);
    alert('Failed to confirm verification code. Please try again.');
  }
}

// Function to book an appointment after successful verification
async function bookAppointment(contactId, date, time) {
  try {
    const response = await fetch(`${apiUrl}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactId,
        date,
        time,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message || 'Appointment booked successfully.');
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Booking error:', error);
    alert('Failed to book appointment. Please try again.');
  }
}

// Event listeners for forms

// Contact form submission
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const contactMethod = document.querySelector('input[name="contactMethod"]:checked').value;
  const contactId = document.getElementById('contactId').value;
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  
  initiateVerification(contactMethod, contactId, name, email);
});

// Verification form submission
verifyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const contactId = document.getElementById('contactId').value;
  const code = document.getElementById('verificationCode').value;

  confirmVerificationCode(contactId, code);
});

// Booking form submission
bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const contactId = document.getElementById('contactId').value; // Should be the verified contact
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;

  bookAppointment(contactId, date, time);
});
