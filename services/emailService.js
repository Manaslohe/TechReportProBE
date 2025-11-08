import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Log email configuration (without sensitive data) on startup
console.log('📧 Email Service Configuration:');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
console.log(`   SMTP_PORT: ${process.env.SMTP_PORT}`);
console.log(`   SMTP_USER: ${process.env.SMTP_USER ? '✓ Set' : '✗ Missing'}`);
console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✓ Set' : '✗ Missing'}`);

// Create transporter with optimized settings for speed
const createTransporter = () => {
	try {
		const cleanPassword = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
		
		const transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST || 'smtp.gmail.com',
			port: Number(process.env.SMTP_PORT) || 465,
			secure: true,
			auth: {
				user: process.env.SMTP_USER,
				pass: cleanPassword
			},
			// Optimized connection pooling
			pool: true,
			maxConnections: 10, // Increased from 5
			maxMessages: Infinity, // No limit on messages per connection
			rateDelta: 1000,
			rateLimit: 10, // Increased from 5
			// Timeouts
			connectionTimeout: 10000, // 10 seconds
			greetingTimeout: 5000, // 5 seconds
			socketTimeout: 20000, // 20 seconds
			// Disable debug in production for speed
			debug: false,
			logger: false
		});

		console.log('✅ [EMAIL] Transporter created with optimized settings');

		// Verify connection asynchronously (non-blocking)
		transporter.verify().then(() => {
			console.log('✅ [EMAIL] Email service verified and ready');
		}).catch((error) => {
			console.error('❌ [EMAIL] Verification failed:', error.message);
		});

		return transporter;
	} catch (error) {
		console.error('❌ [EMAIL] Failed to create transporter:', error.message);
		throw error;
	}
};

const mailTransporter = createTransporter();

// Helper to escape HTML
const htmlEscape = (s = '') =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Resolve frontend base URL from env, preferring FRONTEND_URL, then DOMAIN
const getFrontendUrl = () => {
	const envUrl = (process.env.FRONTEND_URL || '').trim();
	if (envUrl) return envUrl.replace(/\/+$/, '');
	const domain = (process.env.DOMAIN || '').trim();
	if (domain) return `https://www.${domain}`;
	return 'https://www.marketmindsresearch.com';
};

// Build welcome email HTML
const buildWelcomeEmailHtml = ({ firstName, lastName }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- ADD: Spam folder notice at the top -->
				<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 20px;margin:20px;border-radius:8px;text-align:center">
					<p style="color:#856404;font-size:13px;margin:0;line-height:1.6">
						<strong>📧 Can't find this email?</strong><br>
						Check your <strong>Spam/Junk</strong> folder and mark as "Not Spam"
					</p>
				</div>
				
				<!-- Header with gradient -->
				<div style="background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#fff;padding:40px 20px;text-align:center">
					<h1 style="margin:0;font-size:32px;font-weight:bold;letter-spacing:-0.5px">Welcome to MarketMinds!</h1>
					<p style="margin:10px 0 0 0;font-size:16px;opacity:0.95">Your journey to market insights begins here</p>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:24px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)}! 🎉
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 20px 0">
						Thank you for joining <strong style="color:#0b5bd3">MarketMinds</strong>, your trusted partner for comprehensive market research and industry insights.
					</p>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 30px 0">
						We're excited to have you on board
					</p>
					
					<!-- Feature boxes -->
					<div style="background:#f3f4f6;border-radius:12px;padding:25px;margin:0 0 30px 0">
						<h3 style="color:#1f2937;font-size:18px;margin:0 0 15px 0;font-weight:600">What you can do now:</h3>
						<ul style="margin:0;padding:0;list-style:none">
							<li style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:15px">
								<span style="color:#0b5bd3;font-weight:bold">✓</span> Browse our extensive library of market reports
							</li>
							<li style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:15px">
								<span style="color:#0b5bd3;font-weight:bold">✓</span> Access industry trends and analysis
							</li>
							<li style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:15px">
								<span style="color:#0b5bd3;font-weight:bold">✓</span> Download customized reports for your business
							</li>
							<li style="padding:10px 0;color:#4b5563;font-size:15px">
								<span style="color:#0b5bd3;font-weight:bold">✓</span> Connect with our expert analysts
							</li>
						</ul>
					</div>
					
					<!-- CTA Button - Updated URL -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="https://www.marketmindsresearch.com/signin" 
						   style="display:inline-block;background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							Get Started Now
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Need help? Our support team is always here to assist you. Feel free to reach out at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">WhatsApp</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://www.instagram.com/marketmindsresearch/" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Instagram</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build contact form email HTML
export const buildContactEmailHtml = ({ name, email, phone, country, message }) => {
	const ts = new Date().toLocaleString();
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eaeaea;border-radius:10px;overflow:hidden">
				<div style="background:#0b5bd3;color:#fff;padding:16px 20px">
					<h2 style="margin:0;font-size:18px">New Contact Form Submission</h2>
				</div>
				<div style="padding:20px">
					<table style="width:100%;border-collapse:collapse">
						<tr>
							<td style="padding:8px 0;width:160px;color:#666;font-weight:bold">Name</td>
							<td style="padding:8px 0;color:#111">${htmlEscape(name)}</td>
						</tr>
						<tr>
							<td style="padding:8px 0;color:#666;font-weight:bold">Email</td>
							<td style="padding:8px 0;color:#111">${htmlEscape(email)}</td>
						</tr>
						<tr>
							<td style="padding:8px 0;color:#666;font-weight:bold">Phone</td>
							<td style="padding:8px 0;color:#111">${htmlEscape(phone || 'Not provided')}</td>
						</tr>
						<tr>
							<td style="padding:8px 0;color:#666;font-weight:bold">Country</td>
							<td style="padding:8px 0;color:#111">${htmlEscape(country || 'Not provided')}</td>
						</tr>
					</table>
					<div style="margin-top:16px;padding:12px;border:1px solid #eee;border-radius:8px;background:#fafafa">
						<div style="color:#666;font-weight:bold;margin-bottom:6px">Message</div>
						<div style="white-space:pre-wrap;color:#111">${htmlEscape(message || '')}</div>
					</div>
				</div>
				<div style="padding:12px 20px;color:#666;font-size:12px;background:#f8fafc;border-top:1px solid #eee">
					Received at ${htmlEscape(ts)}
				</div>
			</div>
		</div>
	`;
};

// Build OTP email HTML
const buildOTPEmailHtml = ({ firstName, lastName, otp }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#fff;padding:40px 20px;text-align:center">
					<h1 style="margin:0;font-size:28px;font-weight:bold">Password Reset Request</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)}! 👋
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						We received a request to reset your password for your <strong style="color:#0b5bd3">MarketMinds</strong> account. 
						Use the verification code below to proceed:
					</p>
					
					<!-- OTP Box -->
					<div style="background:linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);border:2px dashed #0b5bd3;border-radius:12px;padding:30px;margin:0 0 25px 0;text-align:center">
						<p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1px;font-weight:600">
							Your Verification Code
						</p>
						<div style="font-size:42px;font-weight:bold;color:#0b5bd3;letter-spacing:8px;font-family:monospace;margin:10px 0">
							${htmlEscape(otp)}
						</div>
						<p style="color:#6b7280;font-size:13px;margin:10px 0 0 0">
							⏰ Valid for 10 minutes
						</p>
					</div>
					
					<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px 20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#92400e;font-size:14px;margin:0;line-height:1.6">
							<strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email or contact our support team immediately.
						</p>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Need help? Contact us at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build password reset success email HTML
const buildPasswordResetSuccessHtml = ({ firstName, lastName }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	const timestamp = new Date().toLocaleString();
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#fff;padding:40px 20px;text-align:center">
					<div style="width:64px;height:64px;margin:0 auto 15px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center">
						<span style="font-size:32px">✓</span>
					</div>
					<h1 style="margin:0;font-size:28px;font-weight:bold">Password Reset Successful</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)}! 👋
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						Your password has been successfully reset for your <strong style="color:#0b5bd3">MarketMinds</strong> account.
					</p>
					
					<div style="background:#d1fae5;border-left:4px solid #059669;padding:20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#065f46;font-size:15px;margin:0 0 10px 0;font-weight:600">
							✅ Password Change Confirmed
						</p>
						<p style="color:#047857;font-size:14px;margin:0;line-height:1.6">
							Time: ${htmlEscape(timestamp)}
						</p>
					</div>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						You can now sign in to your account using your new password.
					</p>
					
					<!-- CTA Button -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="https://www.marketmindsresearch.com/signin" 
						   style="display:inline-block;background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							Sign In Now
						</a>
					</div>
					
					<div style="background:#fee2e2;border-left:4px solid #dc2626;padding:15px 20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#991b1b;font-size:14px;margin:0;line-height:1.6">
							<strong>⚠️ Didn't change your password?</strong><br>
							If you didn't make this change, please contact our support team immediately at 
							<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#dc2626;font-weight:600">info.marketmindsresearch@gmail.com</a>
						</p>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Thank you for keeping your account secure!
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build purchase approval email HTML
const buildPurchaseApprovalHtml = ({ firstName, lastName, purchaseType, itemName, amount, subscriptionDetails }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	const isSubscription = purchaseType === 'Subscription';
	
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#fff;padding:40px 20px;text-align:center">
					<div style="width:64px;height:64px;margin:0 auto 15px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center">
						<span style="font-size:32px">✅</span>
					</div>
					<h1 style="margin:0;font-size:28px;font-weight:bold">${isSubscription ? 'Subscription Activated!' : 'Purchase Approved!'}</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)}! 🎉
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						${isSubscription 
							? 'Congratulations! Your subscription has been activated and is now ready to use.'
							: 'Great news! Your purchase has been approved and is now ready to use.'
						}
					</p>
					
					<!-- Purchase Details -->
					<div style="background:#f3f4f6;border-radius:12px;padding:25px;margin:0 0 30px 0;border:2px solid #e5e7eb">
						<h3 style="color:#1f2937;font-size:18px;margin:0 0 15px 0;font-weight:600">Purchase Details</h3>
						<table style="width:100%;border-collapse:collapse">
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Type</td>
								<td style="padding:8px 0;color:#111">${htmlEscape(purchaseType)}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">${isSubscription ? 'Plan' : 'Report'}</td>
								<td style="padding:8px 0;color:#111">${htmlEscape(itemName)}</td>
							</tr>
							${isSubscription && subscriptionDetails ? `
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Duration</td>
								<td style="padding:8px 0;color:#111">${subscriptionDetails.duration} ${subscriptionDetails.duration === 1 ? 'Month' : 'Months'}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Valid Until</td>
								<td style="padding:8px 0;color:#111">${subscriptionDetails.expiryDate ? new Date(subscriptionDetails.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</td>
							</tr>
							` : ''}
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Amount Paid</td>
								<td style="padding:8px 0;color:#111;font-weight:bold;font-size:18px">₹${htmlEscape(amount)}</td>
							</tr>
						</table>
					</div>
					
					${isSubscription && subscriptionDetails ? `
					<!-- Subscription Benefits -->
					<div style="background:linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);border-radius:12px;padding:25px;margin:0 0 30px 0;border:2px solid #93c5fd">
						<h3 style="color:#1e40af;font-size:18px;margin:0 0 15px 0;font-weight:600;display:flex;align-items:center;gap:8px">
							<span>🎁</span> Your Subscription Benefits
						</h3>
						<div style="background:#ffffff;border-radius:8px;padding:20px;margin:0 0 15px 0">
							<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
								<div style="text-align:center;padding:15px;background:#dbeafe;border-radius:8px">
									<div style="font-size:32px;font-weight:bold;color:#1e40af;margin-bottom:5px">
										${subscriptionDetails.premiumReports || 0}
									</div>
									<div style="color:#1e40af;font-size:14px;font-weight:600">Premium Reports</div>
								</div>
								<div style="text-align:center;padding:15px;background:#fae8ff;border-radius:8px">
									<div style="font-size:32px;font-weight:bold;color:#a855f7;margin-bottom:5px">
										${subscriptionDetails.bluechipReports || 0}
									</div>
									<div style="color:#a855f7;font-size:14px;font-weight:600">Bluechip Reports</div>
								</div>
							</div>
							<div style="text-align:center;margin-top:15px;padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac">
								<div style="font-size:20px;font-weight:bold;color:#059669">
									Total: ${subscriptionDetails.totalReports || 0} Reports
								</div>
							</div>
						</div>
						<ul style="margin:0;padding:0;list-style:none">
							<li style="padding:8px 0;color:#1e40af;font-size:15px;display:flex;align-items:start;gap:8px">
								<span style="font-weight:bold;flex-shrink:0">✓</span>
								<span>Access to premium market analysis and insights</span>
							</li>
							<li style="padding:8px 0;color:#1e40af;font-size:15px;display:flex;align-items:start;gap:8px">
								<span style="font-weight:bold;flex-shrink:0">✓</span>
								<span>Download and view reports anytime during subscription period</span>
							</li>
							<li style="padding:8px 0;color:#1e40af;font-size:15px;display:flex;align-items:start;gap:8px">
								<span style="font-weight:bold;flex-shrink:0">✓</span>
								<span>Expert analysis from industry professionals</span>
							</li>
							<li style="padding:8px 0;color:#1e40af;font-size:15px;display:flex;align-items:start;gap:8px">
								<span style="font-weight:bold;flex-shrink:0">✓</span>
								<span>Priority customer support</span>
							</li>
						</ul>
					</div>
					` : ''}
					
					<div style="background:#d1fae5;border-left:4px solid #059669;padding:20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#065f46;font-size:15px;margin:0 0 10px 0;font-weight:600">
							✨ What's Next?
						</p>
						<p style="color:#047857;font-size:14px;margin:0;line-height:1.6">
							${isSubscription 
								? 'Your subscription is now active! You can start accessing premium reports immediately from your dashboard.'
								: 'Your report is now available! You can view and download it anytime from your dashboard.'
							}
						</p>
					</div>
					
					<!-- CTA Button -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="https://www.marketmindsresearch.com/dashboard" 
						   style="display:inline-block;background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							${isSubscription ? 'Browse Reports' : 'View Report'}
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						All your purchases and subscription details are available in your 
						<a href="https://www.marketmindsresearch.com/dashboard" style="color:#0b5bd3;text-decoration:none;font-weight:600">User Dashboard</a>.
					</p>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:15px 0 0 0">
						Need help? Contact us at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build subscription expiry email HTML
const buildSubscriptionExpiryEmailHtml = ({ firstName, lastName, planName, expiryDate }) => {
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:#dc2626;color:#fff;padding:40px 20px;text-align:center">
					<h1 style="margin:0;font-size:28px;font-weight:bold">Subscription Expired</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(firstName)} ${htmlEscape(lastName)}!
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						We're sorry to inform you that your subscription for the plan <strong>${htmlEscape(planName)}</strong> has expired on ${new Date(expiryDate).toLocaleDateString()}.
					</p>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						To continue enjoying our premium reports and features, please renew your subscription at the earliest.
					</p>
					
					<!-- Renewal Button -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="${getFrontendUrl()}/plans" 
						   style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							Renew Subscription
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Need assistance? Contact our support team at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build subscription expiry warning email HTML
const buildSubscriptionExpiryWarningEmailHtml = ({ firstName, lastName, planName, expiryDate, daysLeft }) => {
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:#f59e0b;color:#fff;padding:40px 20px;text-align:center">
					<h1 style="margin:0;font-size:28px;font-weight:bold">Subscription Expiring Soon</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(firstName)} ${htmlEscape(lastName)}!
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						This is a friendly reminder that your subscription for the plan <strong>${htmlEscape(planName)}</strong> will expire in <strong>${htmlEscape(daysLeft)} days</strong> on ${new Date(expiryDate).toLocaleDateString()}.
					</p>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						Renew now to ensure uninterrupted access to our premium reports and features.
					</p>
					
					<!-- Renewal Button -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="${getFrontendUrl()}/plans" 
						   style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							Renew Now
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						For any queries, feel free to contact our support team at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds Research. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://www.marketmindsresearch.com" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Optimized send function wrapper
const sendMailFast = async (mailOptions, emailType = 'email') => {
	try {
		const startTime = Date.now();
		console.log(`📧 [${emailType.toUpperCase()}] Sending to: ${mailOptions.to}`);
		
		// Send immediately without waiting for verification
		const info = await mailTransporter.sendMail(mailOptions);
		
		const duration = Date.now() - startTime;
		console.log(`✅ [${emailType.toUpperCase()}] Sent in ${duration}ms`);
		console.log(`   → Message ID: ${info.messageId}`);
		
		return { success: true, messageId: info.messageId, duration };
	} catch (error) {
		console.error(`❌ [${emailType.toUpperCase()}] Failed:`, error.message);
		throw error;
	}
};

// Send welcome email
export const sendWelcomeEmail = async ({ email, firstName, lastName }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds Research';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		if (!fromEmail || !email?.includes('@')) {
			throw new Error('Invalid email configuration');
		}

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: '🎉 Welcome to MarketMinds - Let\'s Get Started!',
			html: buildWelcomeEmailHtml({ firstName, lastName }),
			// Priority headers
			headers: {
				'X-Priority': '3',
				'Importance': 'normal'
			}
		};

		return await sendMailFast(mailOptions, 'WELCOME');
	} catch (error) {
		console.error('❌ [WELCOME EMAIL] Error:', error.message);
		return { success: false, error: error.message };
	}
};

// Send OTP email - HIGHEST PRIORITY
// NOTE: OTP emails are now handled by services/otpEmailService.js for speed and isolation.

// Send password reset success email
export const sendPasswordResetSuccessEmail = async ({ email, firstName, lastName }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds Research';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: '✅ Password Successfully Reset - MarketMinds',
			html: buildPasswordResetSuccessHtml({ firstName, lastName })
		};

		return await sendMailFast(mailOptions, 'RESET-SUCCESS');
	} catch (error) {
		console.error('❌ [RESET SUCCESS] Error:', error.message);
		throw error;
	}
};

// Send purchase approval email
export const sendPurchaseApprovalEmail = async ({ email, firstName, lastName, purchaseType, itemName, amount, subscriptionDetails }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: purchaseType === 'Subscription' ? '🎉 Subscription Activated - MarketMinds' : '✅ Purchase Approved - MarketMinds',
			html: buildPurchaseApprovalHtml({ firstName, lastName, purchaseType, itemName, amount, subscriptionDetails })
		};

		return await sendMailFast(mailOptions, 'PURCHASE');
	} catch (error) {
		console.error('❌ [PURCHASE EMAIL] Error:', error.message);
		throw error;
	}
};

// Send subscription report access email
export const sendSubscriptionReportAccessEmail = async ({ email, firstName, lastName, reportTitle, reportSector, remainingReports }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: '📊 Report Unlocked - MarketMinds',
			html: buildSubscriptionReportAccessHtml({ firstName, lastName, reportTitle, reportSector, remainingReports })
		};

		return await sendMailFast(mailOptions, 'REPORT-ACCESS');
	} catch (error) {
		console.error('❌ [REPORT ACCESS EMAIL] Error:', error.message);
		throw error;
	}
};

// Send contact form email
export const sendContactEmail = async ({ name, email, phone, country, message }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'Contact Form';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
		const toEmail = process.env.MAIL_TO || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: toEmail,
			subject: `New Contact form submission - MarketMinds`,
			html: buildContactEmailHtml({ name, email, phone, country, message })
		};

		return await sendMailFast(mailOptions, 'CONTACT');
	} catch (error) {
		console.error('❌ [CONTACT EMAIL] Error:', error.message);
		throw error;
	}
};

// Send subscription expiry email
export const sendSubscriptionExpiryEmail = async ({ email, firstName, lastName, planName, expiryDate }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: 'Your MarketMinds Subscription Has Expired',
			html: buildSubscriptionExpiryEmailHtml({ firstName, lastName, planName, expiryDate })
		};

		return await sendMailFast(mailOptions, 'SUBSCRIPTION-EXPIRED');
	} catch (error) {
		console.error('❌ [SUBSCRIPTION EXPIRED EMAIL] Error:', error.message);
		throw error;
	}
};

// Send subscription expiry warning email
export const sendSubscriptionExpiryWarningEmail = async ({ email, firstName, lastName, planName, expiryDate, daysLeft }) => {
	try {
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject: `Your MarketMinds Subscription Expires in ${daysLeft} Days`,
			html: buildSubscriptionExpiryWarningEmailHtml({ firstName, lastName, planName, expiryDate, daysLeft })
		};

		return await sendMailFast(mailOptions, 'SUBSCRIPTION-WARNING');
	} catch (error) {
		console.error('❌ [SUBSCRIPTION WARNING EMAIL] Error:', error.message);
		throw error;
	}
};

export default {
	sendWelcomeEmail,
	sendContactEmail,
	sendPasswordResetSuccessEmail,
	sendPurchaseApprovalEmail,
	sendSubscriptionReportAccessEmail,
	sendSubscriptionExpiryEmail,
	sendSubscriptionExpiryWarningEmail
};
