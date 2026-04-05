const nodemailer = require('nodemailer');

let mailerInstance = null;

const setupMail = () => {
  if (!mailerInstance) {
    mailerInstance = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return mailerInstance;
};

// send notification when order is executed
const notifyOrderExecution = async (userID, ordData, exc) => {
  try {
    const ml = setupMail();

    const mailOpts = {
      from: process.env.SMTP_USER,
      to: `user${userID}@example.com`,
      subject: `Order Executed - Order #${exc.executionDetails.orderId}`,
      html: `
        <h2>Order Execution</h2>
        <p><strong>Order ID:</strong> ${exc.executionDetails.orderId}</p>
        <p><strong>Product:</strong> ${ordData.productName}</p>
        <p><strong>Qty:</strong> ${ordData.quantity}</p>
        <p><strong>Time:</strong> ${new Date(exc.executedAt).toLocaleString()}</p>
        <p><strong>Total Runs:</strong> ${ordData.totalExecutions}</p>
        <p>Your scheduled order has been processed.</p>
      `,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Email notification:', mailOpts);
      return true;
    }

    await ml.sendMail(mailOpts);
    console.log(`Email sent for order ${exc._id}`);
    return true;

  } catch (error) {
    console.error('Email error:', error.message);
    throw error;
  }
};

// confirmation email when order is scheduled
const sendConfirmation = async (emailAddr, schOrdr) => {
  try {
    const ml = setupMail();

    const mailOpts = {
      from: process.env.SMTP_USER,
      to: emailAddr,
      subject: `Order Scheduled - Next Run: ${new Date(schOrdr.scheduledTime).toLocaleString()}`,
      html: `
        <h2>Order Schedule Confirmation</h2>
        <p>Your order has been scheduled.</p>
        <p><strong>Product:</strong> ${schOrdr.productName}</p>
        <p><strong>Qty:</strong> ${schOrdr.quantity}</p>
        <p><strong>Recurrence:</strong> ${schOrdr.recurrenceType}</p>
        <p><strong>First Run:</strong> ${new Date(schOrdr.scheduledTime).toLocaleString()}</p>
        <p>You will get notifications when it runs.</p>
      `,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Confirmation email:', mailOpts);
      return true;
    }

    await ml.sendMail(mailOpts);
    console.log(`Confirmation email sent to ${emailAddr}`);
    return true;

  } catch (error) {
    console.error('Email error:', error.message);
    throw error;
  }
};

module.exports = {
  notifyOrderExecution,
  sendConfirmation,
  setupMail,
};
