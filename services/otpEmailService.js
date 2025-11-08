import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Factory for a lightweight transporter (no pooling → immediate socket per send)
const createOtpTransport = (cfg) => nodemailer.createTransport({
  host: cfg.host,
  port: Number(cfg.port) || 465,
  secure: true,
  auth: {
    user: cfg.user,
    pass: (cfg.pass || '').replace(/\s+/g, '')
  },
  pool: false,
  // Tighter timeouts in production to fail fast and fall back
  connectionTimeout: process.env.NODE_ENV === 'production' ? 5000 : 8000,
  greetingTimeout: process.env.NODE_ENV === 'production' ? 3000 : 4000,
  socketTimeout: process.env.NODE_ENV === 'production' ? 10000 : 15000,
  logger: false,
  debug: false
});

// Primary SMTP (defaults to global SMTP_* envs)
// Use existing SMTP_* env vars (no new .env entries required)
const primaryCfg = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 465,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS
};
const otpTransporter = createOtpTransport(primaryCfg);

// Optional fallback SMTP (e.g., Postmark/Mailgun/SendGrid SMTP)
// Fallback disabled by default since we only have one SMTP in current .env
const hasFallback = false;
const fallbackTransporter = null;

// Verify once (non-blocking)
Promise.allSettled([
  otpTransporter.verify(),
  hasFallback ? fallbackTransporter.verify() : Promise.resolve()
]).then((results) => {
  const [primaryRes, fallbackRes] = results;
  console.log('✅ [OTP EMAIL] Primary transporter', primaryRes.status === 'fulfilled' ? 'verified' : 'NOT verified');
  if (hasFallback) {
    console.log('✅ [OTP EMAIL] Fallback transporter', fallbackRes.status === 'fulfilled' ? 'verified' : 'NOT verified');
  }
}).catch(() => {/* no-op */});

// Local HTML escape helper
const htmlEscape = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Minimal, focused OTP email template (smaller footprint than general template → faster rendering)
const buildOTPEmailHtml = ({ firstName, lastName, otp }) => {
  const fullName = `${firstName} ${lastName}`.trim();
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;padding:24px">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#0b5bd3;color:#fff;padding:28px 24px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:600;letter-spacing:-0.5px">Password Reset Code</h1>
          <p style="margin:8px 0 0 0;font-size:14px;opacity:0.9">Use this code to proceed</p>
        </div>
        <div style="padding:32px 28px">
          <p style="margin:0 0 18px 0;color:#374151;font-size:15px">Hi ${htmlEscape(fullName)},</p>
          <p style="margin:0 0 20px 0;color:#4b5563;font-size:14px;line-height:1.5">We received a request to reset your password. Enter the code below in the app. It expires in <strong>10 minutes</strong>.</p>
          <div style="text-align:center;margin:24px 0">
            <div style="display:inline-block;font-family:monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:#0b5bd3;padding:18px 26px;border:2px dashed #0b5bd3;border-radius:12px;background:#f0f7ff">
              ${htmlEscape(otp)}
            </div>
          </div>
          <p style="margin:0 0 16px 0;color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          <p style="margin:0;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:16px">Need help? Email <a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a></p>
        </div>
      </div>
    </div>
  `;
};

const sendWithTimeout = (transporter, mailOptions, timeoutMs) => {
  return Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) => setTimeout(() => reject(new Error('OTP send timeout')), timeoutMs))
  ]);
};

// High-priority send
export const sendOTPEmail = async ({ email, firstName, lastName, otp }) => {
  const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

  if (!fromEmail || !email?.includes('@')) {
    throw new Error('Invalid OTP email configuration');
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: '🔐 Your Password Reset Code',
    html: buildOTPEmailHtml({ firstName, lastName, otp }),
    priority: 'high',
    headers: {
      'X-Priority': '1',
      'Importance': 'high',
      'X-MSMail-Priority': 'High'
    }
  };

  const start = Date.now();
  const timeoutMs = process.env.NODE_ENV === 'production' ? 7000 : 15000;
  try {
    // Try primary with fast timeout
    const info = await sendWithTimeout(otpTransporter, mailOptions, timeoutMs);
    const ms = Date.now() - start;
    console.log(`✅ [OTP EMAIL] Sent (primary) to ${email} in ${ms}ms (id=${info.messageId})`);
    return { success: true, messageId: info.messageId, duration: ms, via: 'primary' };
  } catch (err1) {
    console.warn('⚠️ [OTP EMAIL] Primary send failed:', err1.message);
    if (hasFallback && fallbackTransporter) {
      try {
        const info2 = await sendWithTimeout(fallbackTransporter, mailOptions, timeoutMs);
        const ms2 = Date.now() - start;
        console.log(`✅ [OTP EMAIL] Sent (fallback) to ${email} in ${ms2}ms (id=${info2.messageId})`);
        return { success: true, messageId: info2.messageId, duration: ms2, via: 'fallback' };
      } catch (err2) {
        console.error('❌ [OTP EMAIL] Fallback send failed:', err2.message);
        throw err2;
      }
    }
    throw err1;
  }
};

export default { sendOTPEmail };