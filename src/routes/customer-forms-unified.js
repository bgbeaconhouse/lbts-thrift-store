// src/routes/customer-forms-unified.js
// Unified API routes for Customer Forms with immediate email sending

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper function to format date string for PostgreSQL DATE column
// This prevents timezone conversion issues by ensuring dates are stored as-is
function formatDateForDB(dateString) {
  if (!dateString) return null;
  
  // If it's already in YYYY-MM-DD format, validate and return as-is
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(dateRegex);
  
  if (match) {
    // Validate that it's a real date
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // Return the date string as-is - PostgreSQL DATE type doesn't use timezone
      return dateString;
    }
  }
  
  return null;
}

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

// Separate storage config for edit routes (type comes from URL param, not body)
const editStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Extract type from URL params: /:type/:id
    const formType = req.params.type || 'pickup';
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
    // Extract type from URL params
    const formType = req.params.type || 'pickup';
    
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

// Separate upload middleware for edit routes
const editUpload = multer({
  storage: editStorage,
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
        <h2 style="margin:10px 0 0;font-weight:400;color:#2d3748">Delivery Receipt</h2>
      </div>
      
      <div style="padding: 30px; background: white;">
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
          Dear ${form.customer_name},
        </p>
        
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6;">
          Thank you for your purchase! This email confirms your delivery details.
        </p>
        
        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d3748; margin-top: 0;">Delivery Details:</h3>
          <p style="color: #4a5568; line-height: 1.8; margin: 5px 0;">
            <strong>Name:</strong> ${form.customer_name}<br>
            <strong>Phone:</strong> ${form.phone}<br>
            <strong>Delivery Address:</strong> ${form.delivery_address || 'N/A'}<br>
            <strong>Delivery Cost:</strong> $${form.delivery_cost ? parseFloat(form.delivery_cost).toFixed(2) : '0.00'}<br>
            <strong>Scheduled Date:</strong> ${form.date_scheduled ? new Date(form.date_scheduled).toLocaleDateString() : form.delivery_date ? new Date(form.delivery_date).toLocaleDateString() : 'N/A'}
          </p>
          ${form.items_description ? `
            <p style="color: #4a5568; line-height: 1.8; margin-top: 15px;">
              <strong>Items:</strong><br>
              ${form.items_description}
            </p>
          ` : ''}
        </div>
        
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">⚠️ Important Delivery Terms</h3>
          <p style="color: #856404; line-height: 1.8; margin: 0;">
            I hereby acknowledge that my payment shown above is solely for the delivery of the item(s) to the residence indicated at the time of purchase. The Beacon House Thrift Shop is not responsible for moving said item(s) into said residence due to issues with liability. The item(s) will be placed in the driveway or the front yard.
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

function getDonationEmailTemplate(form) {
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
        <h2 style="margin:10px 0 0;font-weight:400;color:#2d3748">Donation Receipt</h2>
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
        <h2 style="margin:10px 0 0;font-weight:400;color:#2d3748">Waiver Receipt</h2>
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
               date, 
               to_char(date_purchased, 'YYYY-MM-DD') as date_purchased, 
               to_char(date_stored, 'YYYY-MM-DD') as date_stored, 
               picture_urls, notes,
               email_sent, email_sent_at, email_error, created_at
        FROM ${tableName}
        WHERE deleted_at IS NULL 
        ORDER BY created_at DESC
      `;
    } else if (type === 'delivery') {
      query = `
        SELECT id, customer_name, phone, email, items_description, delivery_address,
               delivery_cost, 
               to_char(delivery_date, 'YYYY-MM-DD') as delivery_date, 
               to_char(date_scheduled, 'YYYY-MM-DD') as date_scheduled, 
               signature_url, 
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

  // Debug logging for dates
  console.log('📅 Date values received:');
  console.log('  date_purchased:', date_purchased);
  console.log('  date_stored:', date_stored);
  console.log('  date_scheduled:', date_scheduled);
  console.log('  Formatted date_purchased:', formatDateForDB(date_purchased));
  console.log('  Formatted date_stored:', formatDateForDB(date_stored));
  console.log('  Formatted date_scheduled:', formatDateForDB(date_scheduled));

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
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6::date, $7::date, $8, $9, $10, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, items_description || notes, signatureUrl, 
         formatDateForDB(date_purchased), formatDateForDB(date_stored), pictureUrls, notes || null, req.user.id]
      );
    } else if (form_type === 'delivery') {
      result = await db.query(
        `INSERT INTO ${tableName} 
         (customer_name, phone, email, items_description, delivery_address,
          delivery_cost, delivery_date, date_scheduled, signature_url, 
          date, picture_urls, notes, created_by, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, CURRENT_DATE, $10, $11, $12, false, NULL)
         RETURNING *`,
        [customer_name, phone, email || null, items_description || notes, delivery_address || null,
         delivery_cost || null, formatDateForDB(delivery_date), formatDateForDB(date_scheduled), signatureUrl,
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

// ==================== UPDATE FORM ====================

router.put('/:type/:id', authenticateToken, editUpload.fields([
  { name: 'new_pictures', maxCount: 10 }
]), async (req, res) => {
  const { type, id } = req.params;
  let {
    customer_name,
    phone,
    email,
    items_description,
    notes,
    date_purchased,
    date_stored,
    delivery_address,
    delivery_cost,
    date_scheduled,
    photos_to_delete
  } = req.body;
  
  // Parse photos_to_delete if it's a JSON string
  if (typeof photos_to_delete === 'string') {
    try {
      photos_to_delete = JSON.parse(photos_to_delete);
    } catch (e) {
      photos_to_delete = [];
    }
  }
  
  // Validate type
  const validTypes = ['pickup', 'delivery'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type for editing' });
  }
  
  // Validate required fields
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }
  
  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;
    
    // Get current photos
    const currentForm = await db.query(
      `SELECT picture_urls FROM ${tableName} WHERE id = $1`,
      [id]
    );
    
    let updatedPhotoUrls = null;
    
    if (currentForm.rows.length > 0) {
      let currentPhotos = currentForm.rows[0].picture_urls || [];
      
      // Handle photo deletion
      if (photos_to_delete && photos_to_delete.length > 0) {
        // Remove photos marked for deletion
        currentPhotos = currentPhotos.filter(url => !photos_to_delete.includes(url));
        
        // Delete photo files from filesystem
        photos_to_delete.forEach(photoUrl => {
          const filePath = path.join(__dirname, '../..', photoUrl);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting photo file:', err);
          });
        });
      }
      
      // Handle new photo uploads
      if (req.files && req.files.new_pictures && req.files.new_pictures.length > 0) {
        const newPhotoUrls = req.files.new_pictures.map(file => `/uploads/${type}/${file.filename}`);
        currentPhotos = [...currentPhotos, ...newPhotoUrls];
      }
      
      // Only update if we modified photos
      if ((photos_to_delete && photos_to_delete.length > 0) || 
          (req.files && req.files.new_pictures && req.files.new_pictures.length > 0)) {
        updatedPhotoUrls = currentPhotos;
      }
    }
    
    let result;
    
    if (type === 'pickup') {
      // Validate pickup-specific required fields
      if (!date_stored) {
        return res.status(400).json({ error: 'Pick-up date is required' });
      }
      
      result = await db.query(
        `UPDATE ${tableName}
         SET customer_name = $1,
             phone = $2,
             email = $3,
             items_description = $4,
             notes = $5,
             date_purchased = $6::date,
             date_stored = $7::date
             ${updatedPhotoUrls !== null ? ', picture_urls = $9' : ''}
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING *`,
        updatedPhotoUrls !== null 
          ? [
              customer_name,
              phone,
              email || null,
              items_description || null,
              notes || null,
              formatDateForDB(date_purchased),
              formatDateForDB(date_stored),
              id,
              updatedPhotoUrls
            ]
          : [
              customer_name,
              phone,
              email || null,
              items_description || null,
              notes || null,
              formatDateForDB(date_purchased),
              formatDateForDB(date_stored),
              id
            ]
      );
    } else if (type === 'delivery') {
      // Validate delivery-specific required fields
      if (!delivery_address || !delivery_cost || !date_scheduled) {
        return res.status(400).json({ error: 'Delivery address, cost, and date are required' });
      }
      
      result = await db.query(
        `UPDATE ${tableName}
         SET customer_name = $1,
             phone = $2,
             email = $3,
             items_description = $4,
             notes = $5,
             delivery_address = $6,
             delivery_cost = $7,
             date_scheduled = $8::date
             ${updatedPhotoUrls !== null ? ', picture_urls = $10' : ''}
         WHERE id = $9 AND deleted_at IS NULL
         RETURNING *`,
        updatedPhotoUrls !== null
          ? [
              customer_name,
              phone,
              email || null,
              items_description || null,
              notes || null,
              delivery_address,
              delivery_cost,
              formatDateForDB(date_scheduled),
              id,
              updatedPhotoUrls
            ]
          : [
              customer_name,
              phone,
              email || null,
              items_description || null,
              notes || null,
              delivery_address,
              delivery_cost,
              formatDateForDB(date_scheduled),
              id
            ]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    res.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} form updated successfully`,
      form: result.rows[0]
    });
    
  } catch (error) {
    console.error(`Update ${type} form error:`, error);
    res.status(500).json({ error: `Failed to update ${type} form` });
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

// ==================== RECENTLY DELETED ====================

// GET /:type/recently-deleted - Get recently deleted forms (within 7 days)
router.get('/:type/recently-deleted', authenticateToken, async (req, res) => {
  const { type } = req.params;
  
  // Validate type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;

    const result = await db.query(
      `SELECT *,
        EXTRACT(DAY FROM (NOW() - deleted_at)) as days_deleted
       FROM ${tableName}
       WHERE deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '7 days'
       ORDER BY deleted_at DESC`
    );

    res.json({ forms: result.rows });
  } catch (error) {
    console.error(`Get recently deleted ${type} forms error:`, error);
    res.status(500).json({ error: `Failed to get recently deleted ${type} forms` });
  }
});

// POST /:type/:id/restore - Restore a deleted form
router.post('/:type/:id/restore', authenticateToken, async (req, res) => {
  const { type, id } = req.params;
  
  // Validate type
  const validTypes = ['pickup', 'delivery', 'donation', 'waiver'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const db = req.app.locals.db;
    const tableName = `${type}_forms`;

    // Check if form exists and was deleted within 7 days
    const checkResult = await db.query(
      `SELECT id, deleted_at
       FROM ${tableName}
       WHERE id = $1
         AND deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '7 days'`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found or cannot be restored (deleted more than 7 days ago)' });
    }

    // Restore the form
    const result = await db.query(
      `UPDATE ${tableName}
       SET deleted_at = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ 
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} form restored successfully`,
      form: result.rows[0]
    });
  } catch (error) {
    console.error(`Restore ${type} form error:`, error);
    res.status(500).json({ error: `Failed to restore ${type} form` });
  }
});

// ==================== CONVERT FORM ====================

router.post('/convert', authenticateToken, upload.fields([
  { name: 'signature', maxCount: 1 }
]), async (req, res) => {
  const { from_type, to_type, form_id, delivery_address, delivery_cost, date_scheduled, date_purchased, date_stored } = req.body;
  
  // Validate types
  const validTypes = ['pickup', 'delivery'];
  if (!validTypes.includes(from_type) || !validTypes.includes(to_type)) {
    return res.status(400).json({ error: 'Invalid form types for conversion' });
  }
  
  if (from_type === to_type) {
    return res.status(400).json({ error: 'Cannot convert to the same type' });
  }
  
  // Validate conversion direction
  if ((from_type === 'pickup' && to_type !== 'delivery') || 
      (from_type === 'delivery' && to_type !== 'pickup')) {
    return res.status(400).json({ error: 'Invalid conversion direction' });
  }

  // Validate signature
  if (!req.files || !req.files.signature || req.files.signature.length === 0) {
    return res.status(400).json({ error: 'Customer signature is required' });
  }

  try {
    const db = req.app.locals.db;
    const fromTableName = `${from_type}_forms`;
    const toTableName = `${to_type}_forms`;
    
    // Get signature URL
    const signatureFile = req.files.signature[0];
    const signatureUrl = `/uploads/signatures/${signatureFile.filename}`;
    
    // Get original form
    const originalResult = await db.query(
      `SELECT * FROM ${fromTableName} WHERE id = $1 AND deleted_at IS NULL`,
      [form_id]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Original form not found' });
    }

    const originalForm = originalResult.rows[0];
    let emailSent = false;
    let emailError = null;

    // Create new form with converted type
    let newFormResult;
    
    if (to_type === 'delivery') {
      // Convert pickup to delivery
      if (!delivery_address || !delivery_cost || !date_scheduled) {
        return res.status(400).json({ error: 'Missing required delivery fields' });
      }
      
      newFormResult = await db.query(
        `INSERT INTO ${toTableName} 
         (customer_name, phone, email, items_description, delivery_address,
          delivery_cost, delivery_date, date_scheduled, signature_url, 
          date, picture_urls, notes, created_by, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, CURRENT_DATE, $10, $11, $12, false, NULL)
         RETURNING *`,
        [
          originalForm.customer_name,
          originalForm.phone,
          originalForm.email || null,
          originalForm.items_description || originalForm.notes,
          delivery_address,
          delivery_cost,
          formatDateForDB(date_scheduled), // Use as delivery_date
          formatDateForDB(date_scheduled), // Also use as date_scheduled
          signatureUrl, // Use new signature
          originalForm.picture_urls || null,
          originalForm.notes || null,
          req.user.id
        ]
      );
    } else {
      // Convert delivery to pickup
      if (!date_stored) {
        return res.status(400).json({ error: 'Missing required pickup date' });
      }
      
      newFormResult = await db.query(
        `INSERT INTO ${toTableName} 
         (customer_name, phone, email, items_description, signature_url, 
          date, date_purchased, date_stored, picture_urls, notes, 
          created_by, email_sent, email_error)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6::date, $7::date, $8, $9, $10, false, NULL)
         RETURNING *`,
        [
          originalForm.customer_name,
          originalForm.phone,
          originalForm.email || null,
          originalForm.items_description || originalForm.notes,
          signatureUrl, // Use new signature
          formatDateForDB(date_purchased),
          formatDateForDB(date_stored),
          originalForm.picture_urls || null,
          originalForm.notes || null,
          req.user.id
        ]
      );
    }

    const newForm = newFormResult.rows[0];

    // Send email for new form type (if email provided)
    if (originalForm.email) {
      try {
        await sendFormEmail(newForm, to_type);
        emailSent = true;
        
        // Update new form with email success
        await db.query(
          `UPDATE ${toTableName} 
           SET email_sent = true, email_sent_at = NOW() 
           WHERE id = $1`,
          [newForm.id]
        );
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
        emailError = emailErr.message;
        
        // Update new form with email error
        await db.query(
          `UPDATE ${toTableName} 
           SET email_error = $1 
           WHERE id = $2`,
          [emailError, newForm.id]
        );
      }
    }

    // Delete original form (soft delete)
    await db.query(
      `UPDATE ${fromTableName} 
       SET deleted_at = NOW() 
       WHERE id = $1`,
      [form_id]
    );

    res.json({ 
      message: `Form converted from ${from_type} to ${to_type} successfully`,
      form: newForm,
      emailSent,
      emailError
    });

  } catch (error) {
    console.error('Convert form error:', error);
    
    // Clean up uploaded signature file on error
    if (req.files && req.files.signature) {
      req.files.signature.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting signature file:', err);
        });
      });
    }
    
    res.status(500).json({ error: 'Failed to convert form' });
  }
});

module.exports = router;