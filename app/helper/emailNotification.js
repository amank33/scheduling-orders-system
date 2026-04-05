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

// send email notification when order executes
const notifyOrderExecution = async (user_id, order_obj, exec) => {
  try {
    const smtp_serv = setupMail();

    const email_opts = {
      from: process.env.SMTP_USER,
      to: `user${user_id}@example.com`,
      subject: `Order Executed - #${exec.executionDetails.orderId}`,
      html: `
        <h2>Order ran</h2>
        <p><strong>Order ID:</strong> ${exec.executionDetails.orderId}</p>
        <p><strong>Product:</strong> ${order_obj.productName}</p>
        <p><strong>Qty:</strong> ${order_obj.quantity}</p>
        <p><strong>When:</strong> ${new Date(exec.executedAt).toLocaleString()}</p>
        <p><strong>Total Times Run:</strong> ${order_obj.totalExecutions}</p>
        <p>Your order was processed.</p>
      `,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Dev mode - email:', email_opts);
      return true;
    }

    await smtp_serv.sendMail(email_opts);
    console.log(`Mail sent for order ${exec._id}`);
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
