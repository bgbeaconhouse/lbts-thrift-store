// src/routes/customer-forms-unified.js
// Unified API routes for Customer Forms with immediate email sending

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads (signatures and photos)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const formType = req.body.form_type || 'pickup';
    const baseUploadDir = process.env.UPLOAD_DIR || 'uploads';
    
    // Signatures go to signatures folder, photos go to form type folder
    let uploadDir;
    if (file.fieldname === 'signature' || file.fieldname === 'manager_signature') {
      uploadDir = path.isAbsolute(baseUploadDir) 
        ? path.join(baseUploadDir, 'signatures')
        : path.join(__dirname, '../..', baseUploadDir, 'signatures');
    } else {
      uploadDir = path.isAbsolute(baseUploadDir)
        ? path.join(baseUploadDir, formType)
        : path.join(__dirname, '../..', baseUploadDir, formType);
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const formType = req.body.form_type || 'pickup';
    
    if (file.fieldname === 'signature' || file.fieldname === 'manager_signature') {
      cb(null, `${file.fieldname}-` + uniqueSuffix + path.extname(file.originalname));
    } else {
      cb(null, `${formType}-` + uniqueSuffix + path.extname(file.originalname));
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file
  },
  fileFilter: function (req, file, cb) {
    // Signatures can be PNG, photos can be any image
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Create email transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

// Email templates
function getPickupEmailTemplate(form) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align:center;padding:20px;background:#ffffff;color:#2d3748">
        <!--[if !mso]><!-->
        <img src="https://raw.githubusercontent.com/bgbeaconhouse/lbts-thrift-store/1ba0b20578bee0123684923c41c8193d7f308c65/public/images/BHdarklogo1.png" 
             alt="Beacon House Logo" 
             width="200" 
             style="display:block;width:200px;max-width:100%;height:auto;margin:0 auto 10px">
        <!--<![endif]-->
        <!--[if mso]>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
        <h1 style="margin:0 0 5px 0;color:#2d3748;font-size:28px;font-family:Arial,sans-serif">Beacon House</h1>
        <p style="margin:0;color:#2d3748;font-size:18px;font-family:Arial,sans-serif">Long Beach Thrift Store</p>
        </td></tr></table>
        <![endif]-->
        <h2 style="margin:10px 0 0;font-weight:400;color:#2d3748">Pick-Up Receipt</h2>
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
            <strong>Purchase Date:</strong> ${form.date_purchased ? new Date(form.date_purchased).toLocaleDateString() : 'N/A'}<br>
            <strong>Pickup Date:</strong> ${form.date_stored ? new Date(form.date_stored).toLocaleDateString() : 'N/A'}
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
          <strong>Beacon House Long Beach Thrift Store</strong>
        </p>
      </div>
      
      <div style="padding: 20px; background: #f7fafc; text-align: center; color: #718096; font-size: 12px;">
        <p style="margin: 0;">Beacon House Long Beach Thrift Store</p>
        <p style="margin: 5px 0;">Phone: (562) 343-7804</p>
      </div>
    </div>
  `;
}

function getDeliveryEmailTemplate(form) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="text-align:center;padding:20px;background:#667eea;color:white"><img src="https://raw.githubusercontent.com/bgbeaconhouse/lbts-thrift-store/1ba0b20578bee0123684923c41c8193d7f308c65/public/images/BHdarklogo1.png" alt="Beacon House Logo" style="max-width:120px;height:auto;margin-bottom:10px"><h2 style="margin:10px 0 0;font-weight:400">Pick-Up Receipt</h2></div><div style="padding:30px;background:white"><p style="color:#2d3748;font-size:16px;line-height:1.6">Dear ${form.customer_name},</p><p style="color:#2d3748;font-size:16px;line-height:1.6">Thank you for your purchase! <strong>You have 48 hours from when you purchased the item to pick it up.</strong></p><div style="background:#f7fafc;padding:20px;border-radius:8px;margin:20px 0"><h3 style="color:#2d3748;margin-top:0">Purchase Details:</h3><p style="color:#4a5568;line-height:1.8;margin:5px 0"><strong>Name:</strong> ${form.customer_name}<br><strong>Phone:</strong> ${form.phone}<br><strong>Date:</strong> ${new Date(form.date).toLocaleDateString()}</p>${form.items_description ? `<p style="color:#4a5568;line-height:1.8;margin-top:15px"><strong>Items:</strong><br>${form.items_description}</p>` : ''}</div><div style="background:#fff3cd;border:2px solid #ffc107;border-radius:8px;padding:20px;margin:20px 0"><h3 style="color:#856404;margin-top:0">⚠️ Important Terms & Conditions</h3><p style="color:#856404;line-height:1.8;margin-bottom:15px">You have <strong>48 hours upon purchase</strong> to pick your item up. After 48 hours the item will be placed back on the sales floor and <strong>no refunds will be issued</strong>.</p><p style="color:#856404;line-height:1.8;margin-bottom:15px">We will gladly assist you in loading your items. Please be aware that it is the customer's responsibility to ensure items are properly loaded and secured. We are not responsible for any damage caused by loading or failure to secure items.</p><p style="color:#856404;line-height:1.8;margin:0">Your signature acknowledges that you have read and understand the terms and conditions covered above.</p></div><p style="color:#4a5568;font-size:14px;line-height:1.6;margin-top:30px">If you have any questions, please contact us at <strong>(562) 343-7804</strong>.</p><p style="color:#2d3748;font-size:16px;line-height:1.6;margin-top:30px">Thank you,<br><strong>LBTS Thrift Store</strong></p></div><div style="padding:20px;background:#f7fafc;text-align:center;color:#718096;font-size:12px"><p style="margin:0">LBTS Thrift Store</p><p style="margin:5px 0">Phone: (562) 343-7804</p></div></div>`;
}

function getDonationEmailTemplate(form) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
     <div style="text-align: center; padding: 20px; background: #667eea; color: white;">
  <img src="https://raw.githubusercontent.com/bgbeaconhouse/lbts-thrift-store/1ba0b20578bee0123684923c41c8193d7f308c65/public/images/BHdarklogo1.png" alt="Beacon House Logo" style="max-width: 120px; height: auto; margin-bottom: 10px;">
  <h2 style="margin: 10px 0 0 0; font-weight: normal;">Donation Receipt</h2>
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
  `;
}

function getWaiverEmailTemplate(form) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; padding: 20px; background: #667eea; color: white;">
        <img src="https://raw.githubusercontent.com/bgbeaconhouse/lbts-thrift-store/1ba0b20578bee0123684923c41c8193d7f308c65/public/images/BHdarklogo1.png" alt="Beacon House Logo" style="max-width: 120px; height: auto; margin-bottom: 10px;">
        <h2 style="margin: 10px 0 0 0; font-weight: normal;">Waiver Receipt</h2>
      </div>
      
      <div style="padding: 30px; background: white;">
        <h2 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
          Release of Liability Form for Loading Purchased Furniture
        </h2>
        
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin-top: 20px;">
          Dear ${form.customer_name},
        </p>
        
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
          Thank you for your purchase. This email serves as confirmation that you have completed our Release of Liability Form.
        </p>
        
        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d3748; margin-top: 0;">Form Details:</h3>
          <p style="color: #4a5568; line-height: 1.8; margin: 5px 0;">
            <strong>Name:</strong> ${form.customer_name}<br>
            <strong>Phone:</strong> ${form.phone}<br>
            <strong>Date:</strong> ${new Date(form.date).toLocaleDateString()}
          </p>
        </div>
        
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">Acknowledgment Summary:</h3>
          
          <p style="color: #856404; line-height: 1.8; margin-bottom: 15px;">
            By signing this form, you have acknowledged and agreed to the following:
          </p>
          
          <ul style="color: #856404; line-height: 1.8; margin-left: 20px;">
            <li><strong>Voluntary Participation:</strong> The loading of furniture into your vehicle is a voluntary service.</li>
            <li><strong>Release of Liability:</strong> You release The Beacon House Association of San Pedro from any claims related to loss, damage, or injury during the loading process.</li>
            <li><strong>Assumption of Risks:</strong> You voluntarily assume all risks associated with loading furniture.</li>
            <li><strong>Care and Supervision:</strong> You are responsible for ensuring your vehicle is suitable for loading furniture.</li>
            <li><strong>Indemnification:</strong> You agree to hold harmless The Beacon House Association from any claims arising from the loading service.</li>
            <li><strong>Vehicle Inspection:</strong> Your vehicle was inspected before loading to ensure it is safe and suitable.</li>
            <li><strong>Personal Property:</strong> You are responsible for any personal belongings left in your vehicle.</li>
            <li><strong>Compliance:</strong> You agree to follow all instructions provided by staff during the loading process.</li>
          </ul>
        </div>
        
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 30px;">
          Please keep this email for your records. If you have any questions, please contact us at <strong>(562) 343-7804</strong>.
        </p>
        
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          Thank you,<br>
          <strong>Beacon House Association of San Pedro</strong>
        </p>
      </div>
      
      <div style="padding: 20px; background: #f7fafc; text-align: center; color: #718096; font-size: 12px;">
        <p style="margin: 0;">Beacon House Association of San Pedro</p>
        <p style="margin: 5px 0;">1003 S. Beacon St, San Pedro, CA 90731</p>
        <p style="margin: 5px 0;">Phone: (310) 514-4940</p>
      </div>
    </div>
  `;
}

// Function to send email immediately
async function sendFormEmail(form, formType) {
  // Check if email is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('Email not configured');
  }

  // Don't send if no email address
  if (!form.email) {
    throw new Error('No email address provided');
  }

  const transporter = createTransporter();

  // Get appropriate template and subject
  let subject, html;
  switch(formType) {
    case 'pickup':
      subject = 'Beacon House - Pick-Up Receipt';
      html = getPickupEmailTemplate(form);
      break;
    case 'delivery':
      subject = 'Beacon House - Delivery Receipt';
      html = getDeliveryEmailTemplate(form);
      break;
    case 'donation':
      subject = 'Beacon House - Donation Receipt';
      html = getDonationEmailTemplate(form);
      break;
    case 'waiver':
      subject = 'Beacon House - Release of Liability Form';
      html = getWaiverEmailTemplate(form);
      break;
    default:
      throw new Error('Invalid form type');
  }

  // Send email
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Beacon House Long Beach Thrift Store <noreply@lbts.local>',
    to: form.email,
    subject: subject,
    html: html
  });
}

// All routes require authentication
router.use(authenticateToken);

// ==================== GET ALL FORMS BY TYPE ====================

router.get('/:type', async (req, res) => {
  const { type } = req.params;
  
  // Validate type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;
    
    let query;
    if (type === 'pickup') {
      query = `
        SELECT id, customer_name, phone, email, items_description, signature_url, 
               date, date_purchased, date_stored, picture_urls, notes,
               email_sent, email_sent_at, email_error, created_at
        FROM ${tableName}
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `;
    } else if (type === 'delivery') {
      query = `
        SELECT id, customer_name, phone, email, items_description, delivery_address,
               delivery_cost, delivery_date, date_scheduled, signature_url, 
               date, picture_urls, notes,
               email_sent, email_sent_at, email_error, created_at
        FROM ${tableName}
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `;
    } else if (type === 'donation') {
      query = `
        SELECT id, customer_name, phone, email, donation_description, signature_url, 
               date, email_sent, email_sent_at, email_error, created_at
        FROM ${tableName}
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `;
    } else { // waiver
      query = `
        SELECT id, customer_name, phone, email, signature_url, manager_signature_url,
               date, email_sent, email_sent_at, email_error, created_at
        FROM ${tableName}
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `;
    }

    const result = await db.query(query);
    res.json({ forms: result.rows });
  } catch (error) {
    console.error(`Get ${type} forms error:`, error);
    res.status(500).json({ error: `Failed to get ${type} forms` });
  }
});

// ==================== CREATE FORM ====================

router.post('/create', upload.fields([
  { name: 'signature', maxCount: 1 },
  { name: 'manager_signature', maxCount: 1 },
  { name: 'pictures', maxCount: 10 }
]), async (req, res) => {
  const { 
    form_type, 
    customer_name, 
    phone, 
    email,
    items_description,
    donation_description,
    date_purchased,
    date_stored,
    delivery_address,
    delivery_cost,
    delivery_date,
    date_scheduled,
    notes
  } = req.body;

  // Validate form type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(form_type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  // Validate required fields
  if (!customer_name || !phone) {
    // Clean up uploaded files
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${form_type}_forms`;
    
    // Get file URLs
    const signatureUrl = req.files['signature'] ? `/uploads/signatures/${req.files['signature'][0].filename}` : null;
    const managerSignatureUrl = req.files['manager_signature'] ? `/uploads/signatures/${req.files['manager_signature'][0].filename}` : null;
    const pictureUrls = req.files['pictures'] ? req.files['pictures'].map(file => `/uploads/${form_type}/${file.filename}`) : [];

    let result;
    let emailSent = false;
    let emailError = null;

    // Insert based on form type
    if (form_type === 'pickup') {
      result = await db.query(
        `INSERT INTO ${tableName} 
         (customer_name, phone, email, items_description, signature_url, 
          date, date_purchased, date_stored, picture_urls, notes, 
          created_by, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, items_description || notes, signatureUrl, 
         date_purchased || null, date_stored || null, pictureUrls, notes || null, req.user.id]
      );
    } else if (form_type === 'delivery') {
      result = await db.query(
        `INSERT INTO ${tableName} 
         (customer_name, phone, email, items_description, delivery_address,
          delivery_cost, delivery_date, date_scheduled, signature_url, 
          date, picture_urls, notes, created_by, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, $10, $11, $12, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, items_description || notes, delivery_address || null,
         delivery_cost || null, delivery_date || null, date_scheduled || null, signatureUrl,
         pictureUrls, notes || null, req.user.id]
      );
    } else if (form_type === 'donation') {
      result = await db.query(
        `INSERT INTO ${tableName} 
         (customer_name, phone, email, donation_description, signature_url, 
          date, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, donation_description || null, signatureUrl]
      );
    } else { // waiver
      result = await db.query(
        `INSERT INTO ${tableName} 
         (customer_name, phone, email, signature_url, manager_signature_url,
          date, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, signatureUrl, managerSignatureUrl]
      );
    }

    const createdForm = result.rows[0];

    // Attempt to send email immediately (if email provided)
    if (email) {
      try {
        await sendFormEmail(createdForm, form_type);
        emailSent = true;
        
        // Update database with email success
        await db.query(
          `UPDATE ${tableName} 
           SET email_sent = true, email_sent_at = NOW() 
           WHERE id = $1`,
          [createdForm.id]
        );
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
        emailError = emailErr.message;
        
        // Update database with email error
        await db.query(
          `UPDATE ${tableName} 
           SET email_error = $1 
           WHERE id = $2`,
          [emailError, createdForm.id]
        );
      }
    }

    // Return response
    res.status(201).json({ 
      message: `${form_type.charAt(0).toUpperCase() + form_type.slice(1)} form created successfully`,
      form: createdForm,
      emailSent,
      emailError
    });

  } catch (error) {
    console.error(`Create ${form_type} form error:`, error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ error: `Failed to create ${form_type} form` });
  }
});

// ==================== RETRY EMAIL ====================

router.post('/retry-email/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  // Validate type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;
    
    // Get form
    const result = await db.query(
      `SELECT * FROM ${tableName} WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = result.rows[0];

    if (!form.email) {
      return res.status(400).json({ error: 'No email address on file' });
    }

    // Attempt to send email
    try {
      await sendFormEmail(form, type);
      
      // Update database with success
      await db.query(
        `UPDATE ${tableName} 
         SET email_sent = true, email_sent_at = NOW(), email_error = NULL 
         WHERE id = $1`,
        [id]
      );

      res.json({ 
        message: 'Email sent successfully',
        emailSent: true
      });
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
      
      // Update database with new error
      await db.query(
        `UPDATE ${tableName} 
         SET email_error = $1 
         WHERE id = $2`,
        [emailErr.message, id]
      );

      res.status(500).json({ 
        error: 'Failed to send email',
        emailError: emailErr.message
      });
    }

  } catch (error) {
    console.error('Retry email error:', error);
    res.status(500).json({ error: 'Failed to retry email' });
  }
});

// ==================== DELETE FORM ====================

router.delete('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  // Validate type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;

    const result = await db.query(
      `UPDATE ${tableName} 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} form deleted successfully` });
  } catch (error) {
    console.error(`Delete ${type} form error:`, error);
    res.status(500).json({ error: `Failed to delete ${type} form` });
  }
});

module.exports = router;