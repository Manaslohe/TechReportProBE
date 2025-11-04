import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create optimized transporter for admin notifications
const createAdminTransporter = () => {
	const cleanPassword = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
	
	return nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.gmail.com',
		port: Number(process.env.SMTP_PORT) || 465,
		secure: true,
		auth: {
			user: process.env.SMTP_USER,
			pass: cleanPassword
		},
		pool: true,
		maxConnections: 10,
		maxMessages: Infinity,
		connectionTimeout: 10000,
		greetingTimeout: 5000,
		socketTimeout: 20000,
		debug: false,
		logger: false
	});
};

const adminMailTransporter = createAdminTransporter();

// Helper to escape HTML
const htmlEscape = (s = '') =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Build approval notification email
const buildApprovalNotificationHtml = ({ firstName, lastName, purchaseType, itemName, amount, requestId, adminComment }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	const isSubscription = purchaseType === 'subscription';
	
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#fff;padding:40px 20px;text-align:center">
					<div style="width:64px;height:64px;margin:0 auto 15px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center">
						<span style="font-size:32px">✅</span>
					</div>
					<h1 style="margin:0;font-size:28px;font-weight:bold">Payment Approved!</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)}! 🎉
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						Great news! Your payment request has been approved by our admin team.
					</p>
					
					<!-- Request Details -->
					<div style="background:#f3f4f6;border-radius:12px;padding:25px;margin:0 0 30px 0;border:2px solid #e5e7eb">
						<h3 style="color:#1f2937;font-size:18px;margin:0 0 15px 0;font-weight:600">Request Details</h3>
						<table style="width:100%;border-collapse:collapse">
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Type</td>
								<td style="padding:8px 0;color:#111">${isSubscription ? 'Subscription Plan' : 'Individual Report'}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">${isSubscription ? 'Plan Name' : 'Report Title'}</td>
								<td style="padding:8px 0;color:#111">${htmlEscape(itemName)}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Amount</td>
								<td style="padding:8px 0;color:#111;font-weight:bold;font-size:18px">₹${htmlEscape(amount)}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Request ID</td>
								<td style="padding:8px 0;color:#111;font-size:12px;font-family:monospace">${htmlEscape(requestId)}</td>
							</tr>
						</table>
					</div>
					
					${adminComment ? `
					<div style="background:#dbeafe;border-left:4px solid #0b5bd3;padding:20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#1e40af;font-size:15px;margin:0 0 10px 0;font-weight:600">
							📝 Admin Message
						</p>
						<p style="color:#1e3a8a;font-size:14px;margin:0;line-height:1.6">
							${htmlEscape(adminComment)}
						</p>
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
							View Dashboard
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Need help? Contact us at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://techreportspro.vercel.app" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Build rejection notification email
const buildRejectionNotificationHtml = ({ firstName, lastName, purchaseType, itemName, amount, requestId, adminComment }) => {
	const fullName = `${firstName} ${lastName}`.trim();
	const isSubscription = purchaseType === 'subscription';
	
	return `
		<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f6f9fc;padding:20px">
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
				<!-- Header -->
				<div style="background:linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);color:#fff;padding:40px 20px;text-align:center">
					<div style="width:64px;height:64px;margin:0 auto 15px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center">
						<span style="font-size:32px">❌</span>
					</div>
					<h1 style="margin:0;font-size:28px;font-weight:bold">Payment Request Rejected</h1>
				</div>
				
				<!-- Main content -->
				<div style="padding:40px 30px">
					<h2 style="color:#1f2937;font-size:22px;margin:0 0 20px 0;font-weight:600">
						Hello ${htmlEscape(fullName)},
					</h2>
					
					<p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 25px 0">
						We regret to inform you that your payment request has been rejected by our admin team.
					</p>
					
					<!-- Request Details -->
					<div style="background:#f3f4f6;border-radius:12px;padding:25px;margin:0 0 30px 0;border:2px solid #e5e7eb">
						<h3 style="color:#1f2937;font-size:18px;margin:0 0 15px 0;font-weight:600">Request Details</h3>
						<table style="width:100%;border-collapse:collapse">
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Type</td>
								<td style="padding:8px 0;color:#111">${isSubscription ? 'Subscription Plan' : 'Individual Report'}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">${isSubscription ? 'Plan Name' : 'Report Title'}</td>
								<td style="padding:8px 0;color:#111">${htmlEscape(itemName)}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Amount</td>
								<td style="padding:8px 0;color:#111;font-weight:bold;font-size:18px">₹${htmlEscape(amount)}</td>
							</tr>
							<tr>
								<td style="padding:8px 0;color:#666;font-weight:bold">Request ID</td>
								<td style="padding:8px 0;color:#111;font-size:12px;font-family:monospace">${htmlEscape(requestId)}</td>
							</tr>
						</table>
					</div>
					
					${adminComment ? `
					<div style="background:#fee2e2;border-left:4px solid #dc2626;padding:20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#991b1b;font-size:15px;margin:0 0 10px 0;font-weight:600">
							📝 Reason for Rejection
						</p>
						<p style="color:#7f1d1d;font-size:14px;margin:0;line-height:1.6">
							${htmlEscape(adminComment)}
						</p>
					</div>
					` : ''}
					
					<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:0 0 25px 0;border-radius:8px">
						<p style="color:#92400e;font-size:15px;margin:0 0 10px 0;font-weight:600">
							💡 What to do next?
						</p>
						<p style="color:#78350f;font-size:14px;margin:0;line-height:1.6">
							Please review the rejection reason above. If you believe this was a mistake or if you have questions, feel free to contact our support team. You can also submit a new request with the correct payment details.
						</p>
					</div>
					
					<!-- CTA Button -->
					<div style="text-align:center;margin:0 0 30px 0">
						<a href="mailto:info.marketmindsresearch@gmail.com" 
						   style="display:inline-block;background:linear-gradient(135deg, #0b5bd3 0%, #1e40af 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(11,91,211,0.3)">
							Contact Support
						</a>
					</div>
					
					<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;border-top:1px solid #e5e7eb;padding-top:20px">
						Need immediate assistance? Contact us at 
						<a href="mailto:info.marketmindsresearch@gmail.com" style="color:#0b5bd3;text-decoration:none;font-weight:600">info.marketmindsresearch@gmail.com</a>
						or WhatsApp us at <a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-weight:600">+91 7987090461</a>
					</p>
				</div>
				
				<!-- Footer -->
				<div style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb">
					<p style="margin:0 0 10px 0;color:#6b7280;font-size:13px">
						© ${new Date().getFullYear()} MarketMinds. All rights reserved.
					</p>
					<div style="margin:15px 0 0 0">
						<a href="https://techreportspro.vercel.app" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Website</a>
						<span style="color:#d1d5db">|</span>
						<a href="https://wa.me/917987090461" style="color:#0b5bd3;text-decoration:none;font-size:13px;margin:0 10px">Support</a>
					</div>
				</div>
			</div>
		</div>
	`;
};

// Send admin notification email - OPTIMIZED
export const sendAdminNotification = async ({ 
	email, 
	firstName, 
	lastName, 
	status, 
	purchaseType, 
	itemName, 
	amount, 
	requestId, 
	adminComment 
}) => {
	try {
		const startTime = Date.now();
		console.log('📧 [ADMIN NOTIFICATION] Sending...');
		console.log(`   → To: ${email}`);
		console.log(`   → Status: ${status}`);
		
		const fromName = process.env.MAIL_FROM_NAME || 'MarketMinds';
		const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
		
		const isApproved = status === 'approved';
		const subject = isApproved 
			? '✅ Payment Approved - MarketMinds' 
			: '❌ Payment Request Rejected - MarketMinds';
		
		const htmlContent = isApproved
			? buildApprovalNotificationHtml({ firstName, lastName, purchaseType, itemName, amount, requestId, adminComment })
			: buildRejectionNotificationHtml({ firstName, lastName, purchaseType, itemName, amount, requestId, adminComment });

		const mailOptions = {
			from: `"${fromName}" <${fromEmail}>`,
			to: email,
			subject,
			html: htmlContent,
			priority: 'high',
			headers: {
				'X-Priority': '1',
				'Importance': 'high'
			}
		};

		const info = await adminMailTransporter.sendMail(mailOptions);
		
		const duration = Date.now() - startTime;
		console.log(`✅ [ADMIN NOTIFICATION] Sent in ${duration}ms`);
		console.log(`   → Message ID: ${info.messageId}`);
		
		return { success: true, messageId: info.messageId, duration };
	} catch (error) {
		console.error('❌ [ADMIN NOTIFICATION] Error:', error?.message || error);
		throw error;
	}
};

export default { sendAdminNotification };
