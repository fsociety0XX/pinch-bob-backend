import cron from 'node-cron';
import TokenService from '@src/services/tokenService';

// Run cleanup every day at 2 AM
const tokenCleanupCron = cron.schedule(
  '0 2 * * *',
  async () => {
    console.log('Starting token cleanup...');
    try {
      await TokenService.cleanupExpiredTokens();
      console.log('Token cleanup completed successfully');
    } catch (error) {
      console.error('Token cleanup failed:', error);
    }
  },
  {
    scheduled: false, // Don't start automatically
    timezone: 'Asia/Kolkata', // Adjust timezone as needed
  }
);

export const startTokenCleanup = (): void => {
  tokenCleanupCron.start();
  console.log('Token cleanup cron job started');
};

export const stopTokenCleanup = (): void => {
  tokenCleanupCron.stop();
  console.log('Token cleanup cron job stopped');
};

export default tokenCleanupCron;
