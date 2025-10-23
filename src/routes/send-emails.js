// src/routes/send-emails.js
// Email sending functionality (Admin only)

const express = require('express');
const nodemailer = require('nodemailer');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require Admin role
router.use(authenticateToken);
router.use(requireRole('Admin'));

// Create email transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

// GET /api/send-emails/pending - Get pending email counts
router.get('/pending', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const pickup = await db.query(
      'SELECT COUNT(*) FROM pickup_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );
    const delivery = await db.query(
      'SELECT COUNT(*) FROM delivery_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );
    const donation = await db.query(
      'SELECT COUNT(*) FROM donation_forms WHERE emailed = FALSE AND deleted_at IS NULL'
    );

    const total = parseInt(pickup.rows[0].count) + 
                  parseInt(delivery.rows[0].count) + 
                  parseInt(donation.rows[0].count);

    res.json({ 
      total,
      pickup: parseInt(pickup.rows[0].count),
      delivery: parseInt(delivery.rows[0].count),
      donation: parseInt(donation.rows[0].count)
    });
  } catch (error) {
    console.error('Get pending emails error:', error);
    res.status(500).json({ error: 'Failed to get pending emails count' });
  }
});

// POST /api/send-emails/send - Send all pending emails
router.post('/send', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return res.status(400).json({ 
        error: 'Email not configured. Please add SMTP settings to .env file.' 
      });
    }

    const transporter = createTransporter();

    // Verify connection
    try {
      await transporter.verify();
    } catch (error) {
      console.error('Email connection failed:', error);
      return res.status(500).json({ 
        error: 'Failed to connect to email server. Check your SMTP settings.' 
      });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Get all pending pickup forms
    const pickupForms = await db.query(
      `SELECT id, customer_name, phone, email, items_description, date
       FROM pickup_forms 
       WHERE emailed = FALSE AND deleted_at IS NULL AND email IS NOT NULL`
    );

// Send pickup emails
for (const form of pickupForms.rows) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Beacon House Thrift Shop - Long Beach <noreply@lbts.local>',
      to: form.email,
      subject: 'Beacon House Thrift Shop - Long Beach - Pick-Up Receipt',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px; background: #667eea; color: white;">
            <h1 style="margin: 0;">Beacon House Thrift Shop - Long Beach</h1>
            <h2 style="margin: 10px 0 0 0; font-weight: normal;">Pick-Up Receipt</h2>
          </div>
          
          <div style="padding: 30px; background: white;">
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
              Dear ${form.customer_name},
            </p>
            
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
              Thank you for your purchase! <strong>You have 48 hours from when you purchased the item to pick it up.</strong>
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">Purchase Details:</h3>
              <p style="color: #4a5568; line-height: 1.8; margin: 5px 0;">
                <strong>Name:</strong> ${form.customer_name}<br>
                <strong>Phone:</strong> ${form.phone}<br>
                <strong>Date:</strong> ${new Date(form.date).toLocaleDateString()}
              </p>
              ${form.items_description ? `
                <p style="color: #4a5568; line-height: 1.8; margin-top: 15px;">
                  <strong>Items:</strong><br>
                  ${form.items_description}
                </p>
              ` : ''}
            </div>
            
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Important Terms & Conditions</h3>
              <p style="color: #856404; line-height: 1.8; margin-bottom: 15px;">
                You have <strong>48 hours upon purchase</strong> to pick your item up. After 48 hours the item will be placed back on the sales floor and <strong>no refunds will be issued</strong>.
              </p>
              <p style="color: #856404; line-height: 1.8; margin-bottom: 15px;">
                We will gladly assist you in loading your items. Please be aware that it is the customer's responsibility to ensure items are properly loaded and secured. We are not responsible for any damage caused by loading or failure to secure items.
              </p>
              <p style="color: #856404; line-height: 1.8; margin: 0;">
                Your signature acknowledges that you have read and understand the terms and conditions covered above.
              </p>
            </div>
            
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 30px;">
              If you have any questions, please contact us at <strong>(562) 343-7804</strong>.
            </p>
            
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              Thank you,<br>
              <strong>Beacon House Thrift Shop Long Beach</strong>
            </p>
          </div>
          
          <div style="padding: 20px; background: #f7fafc; text-align: center; color: #718096; font-size: 12px;">
            <p style="margin: 0;">Beacon House Thrift Shop - Long Beach</p>
            <p style="margin: 5px 0;">Phone: (562) 343-7804</p>
          </div>
        </div>
      `
    });

        // Mark as emailed
        await db.query(
          'UPDATE pickup_forms SET emailed = TRUE WHERE id = $1',
          [form.id]
        );
        
        successCount++;
      } catch (error) {
        console.error('Failed to send pickup email:', error);
        failedCount++;
        errors.push(`Pickup form ${form.id} (${form.email}): ${error.message}`);
      }
    }

    // Get all pending delivery forms
 const deliveryForms = await db.query(
  `SELECT id, customer_name, phone, email, items_description, delivery_cost, delivery_date, date
   FROM delivery_forms 
   WHERE emailed = FALSE AND deleted_at IS NULL AND email IS NOT NULL`
);

   // Send delivery emails
for (const form of deliveryForms.rows) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Beacon House Thrift Shop - Long Beach <noreply@lbts.local>',
      to: form.email,
      subject: 'Beacon House Thrift Shop Long Beach - Delivery Receipt',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px; background: #667eea; color: white;">
            <h1 style="margin: 0;">Beacon House Thrift Shop - Long Beach</h1>
            <h2 style="margin: 10px 0 0 0; font-weight: normal;">Delivery Receipt</h2>
          </div>
          
          <div style="padding: 30px; background: white;">
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
              Dear ${form.customer_name},
            </p>
            
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
              Thank you for your purchase! Your items will be delivered as scheduled.
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">Purchase Details:</h3>
              <p style="color: #4a5568; line-height: 1.8; margin: 5px 0;">
                <strong>Name:</strong> ${form.customer_name}<br>
                <strong>Phone:</strong> ${form.phone}<br>
                <strong>Date:</strong> ${new Date(form.date).toLocaleDateString()}
                ${form.delivery_cost ? `<br><strong>Delivery Cost:</strong> $${parseFloat(form.delivery_cost).toFixed(2)}` : ''}
                ${form.delivery_date ? `<br><strong>Delivery Date:</strong> ${form.delivery_date}` : ''}
              </p>
              ${form.items_description ? `
                <p style="color: #4a5568; line-height: 1.8; margin-top: 15px;">
                  <strong>Items:</strong><br>
                  ${form.items_description}
                </p>
              ` : ''}
            </div>
            
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Important Terms & Conditions</h3>
              <p style="color: #856404; line-height: 1.8; margin: 0;">
                By accepting delivery you hereby acknowledge that cost of delivery is solely for the delivery of the item(s) 
                to the residence indicated at the time of purchase. The Beacon House Thrift Shop is not responsible 
                for moving said item(s) into said residence due to issues with liability. The item(s) will be placed 
                in the driveway or the front yard.
              </p>
            </div>
            
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 30px;">
              If you have any questions, please contact us at <strong>(562) 343-7804</strong>.
            </p>
            
            <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              Thank you,<br>
              <strong>Beacon House Thrift Shop - Long Beach</strong>
            </p>
          </div>
          
          <div style="padding: 20px; background: #f7fafc; text-align: center; color: #718096; font-size: 12px;">
            <p style="margin: 0;">Beacon House Thrift Shop Long Beach</p>
            <p style="margin: 5px 0;">Phone: (562) 343-7804</p>
          </div>
        </div>
      `
    });

        // Mark as emailed
        await db.query(
          'UPDATE delivery_forms SET emailed = TRUE WHERE id = $1',
          [form.id]
        );
        
        successCount++;
      } catch (error) {
        console.error('Failed to send delivery email:', error);
        failedCount++;
        errors.push(`Delivery form ${form.id} (${form.email}): ${error.message}`);
      }
    }

    // Get all pending donation forms
    const donationForms = await db.query(
      `SELECT id, customer_name, phone, email, donation_description, date
       FROM donation_forms 
       WHERE emailed = FALSE AND deleted_at IS NULL AND email IS NOT NULL`
    );

// Send donation emails
for (const form of donationForms.rows) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'The Beacon House Association <contact@thebeaconhouse.org>',
      to: form.email,
      subject: 'Donation Receipt - The Beacon House Association',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px; background: #667eea; color: white;">
            <h1 style="margin: 0;">The Beacon House Association of San Pedro</h1>
            <p style="margin: 5px 0;">1003 S. Beacon St, San Pedro, CA 90731</p>
            <p style="margin: 5px 0;">thebeaconhouse.org | contact@thebeaconhouse.org | (310) 514-4940</p>
          </div>
          
          <div style="padding: 30px; background: white;">
            <h2 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
              Donation Receipt
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6; margin-top: 20px;">
              <strong>Donor Name:</strong> ${form.customer_name}<br>
              <strong>Date:</strong> ${new Date(form.date).toLocaleDateString()}
            </p>
            
            ${form.donation_description ? `
              <p style="color: #4a5568; line-height: 1.6; margin-top: 15px;">
                <strong>Donated Items:</strong><br>
                ${form.donation_description}
              </p>
            ` : ''}
            
            <div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-left: 4px solid #667eea; line-height: 1.8; color: #2d3748;">
              <p style="margin: 0 0 15px 0;">
                Thank you for your generous donation. No one has ever been turned away from the Beacon House Association of San Pedro due to their inability to pay, and because of friends like you, this policy will continue in the future.
              </p>
              <p style="margin: 0 0 15px 0;">
                No goods or services will be transferred to you in connection with this donation.
              </p>
              <p style="margin: 0; font-weight: bold;">
                For your records our tax ID is #23-7376148
              </p>
            </div>
            
            <p style="margin-top: 30px; color: #718096; font-size: 14px; text-align: center;">
              Please keep this receipt for your tax records.
            </p>
          </div>
          
          <div style="padding: 20px; background: #f7fafc; text-align: center; color: #718096; font-size: 12px;">
            <p style="margin: 0;">The Beacon House Association of San Pedro</p>
            <p style="margin: 5px 0;">1003 S. Beacon St, San Pedro, CA 90731</p>
            <p style="margin: 5px 0;">Tax ID: #23-7376148</p>
          </div>
        </div>
      `
    });

        // Mark as emailed
        await db.query(
          'UPDATE donation_forms SET emailed = TRUE WHERE id = $1',
          [form.id]
        );
        
        successCount++;
      } catch (error) {
        console.error('Failed to send donation email:', error);
        failedCount++;
        errors.push(`Donation form ${form.id} (${form.email}): ${error.message}`);
      }
    }

    // Build response
    let message = `Successfully sent ${successCount} email${successCount !== 1 ? 's' : ''}`;
    if (failedCount > 0) {
      message += `, ${failedCount} failed`;
    }

    res.json({ 
      message,
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Send emails error:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

// POST /api/send-emails/test - Send test email to verify configuration
router.post('/test', async (req, res) => {
  const { testEmail } = req.body;

  if (!testEmail) {
    return res.status(400).json({ error: 'Test email address required' });
  }

  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return res.status(400).json({ 
        error: 'Email not configured. Please add SMTP settings to .env file.' 
      });
    }

    const transporter = createTransporter();

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'LBTS Thrift Store <noreply@lbts.local>',
      to: testEmail,
      subject: 'LBTS - Test Email',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your LBTS Thrift Store Management System.</p>
        <p>If you're receiving this, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    });

    res.json({ 
      message: 'Test email sent successfully! Check your inbox.',
      recipient: testEmail
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email: ' + error.message 
    });
  }
});

module.exports = router;