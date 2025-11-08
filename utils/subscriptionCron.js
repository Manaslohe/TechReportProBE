import cron from 'node-cron';
import User from '../models/User.js';
import { sendSubscriptionExpiryEmail, sendSubscriptionExpiryWarningEmail } from '../services/emailService.js';

// Run every day at midnight
export const startSubscriptionExpiryCheck = () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('🔍 [CRON] Checking for expired subscriptions...');
            
            const now = new Date();
            
            // Find users with expired but still active subscriptions
            const users = await User.find({
                'currentSubscription.isActive': true,
                'currentSubscription.expiryDate': { $lt: now }
            });

            console.log(`📊 [CRON] Found ${users.length} expired subscriptions`);

            for (const user of users) {
                // Deactivate subscription
                const prev = user.currentSubscription ? { ...user.currentSubscription.toObject?.() || user.currentSubscription } : null;
                if (user.currentSubscription) {
                    user.currentSubscription.isActive = false;
                    user.subscriptionHistory.push(user.currentSubscription);
                }
                user.currentSubscription = null;

                await user.save();

                // Send expiry notification email
                if (prev) {
                  sendSubscriptionExpiryEmail({
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    planName: prev.planName,
                    expiryDate: prev.expiryDate
                  }).catch(err => {
                    console.error('Failed to send expiry email:', err);
                  });
                }

                console.log(`✅ [CRON] Deactivated subscription for user: ${user.email}`);
            }

            // Check for subscriptions expiring in 3 days (warning email)
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const expiringUsers = await User.find({
                'currentSubscription.isActive': true,
                'currentSubscription.expiryDate': { 
                    $gte: now,
                    $lt: threeDaysFromNow
                }
            });

            console.log(`⚠️ [CRON] Found ${expiringUsers.length} subscriptions expiring soon`);

            for (const user of expiringUsers) {
                // Send warning email
                sendSubscriptionExpiryWarningEmail({
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    planName: user.currentSubscription.planName,
                    expiryDate: user.currentSubscription.expiryDate,
                    daysLeft: Math.ceil((new Date(user.currentSubscription.expiryDate) - now) / (1000 * 60 * 60 * 24))
                }).catch(err => {
                    console.error('Failed to send warning email:', err);
                });
            }

        } catch (error) {
            console.error('❌ [CRON] Error checking subscriptions:', error);
        }
    });

    console.log('✅ [CRON] Subscription expiry check scheduled');
};
