import cron from 'node-cron';
import ReviewsService from '@src/services/reviewsService';

/**
 * Cron job to refresh Google Reviews cache weekly
 * Runs every Sunday at 2:00 AM
 */
export const scheduleReviewsRefresh = (): void => {
  // Run every Sunday at 2:00 AM (0 2 * * 0)
  cron.schedule(
    '0 2 * * 0',
    async () => {
      try {
        console.log('🔄 Starting scheduled reviews refresh...');
        const reviewsService = ReviewsService.getInstance();
        const result = await reviewsService.forceRefresh();

        console.log('✅ Scheduled reviews refresh completed successfully.');
        console.log(`📊 Updated ${result.reviews.length} reviews.`);
        console.log(`⭐ Overall rating: ${result.totalRating || 'N/A'}`);
        console.log(`📝 Total review count: ${result.reviewCount || 'N/A'}`);
      } catch (error) {
        console.error('❌ Scheduled reviews refresh failed:', error);
      }
    },
    {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',
    }
  );

  console.log('📅 Reviews refresh cron job scheduled (Sundays at 2:00 AM UTC)');
};

/**
 * Start the reviews refresh cron job
 */
export const startReviewsRefreshCron = (): void => {
  scheduleReviewsRefresh();
  console.log('🚀 Reviews refresh cron job started');
};

/**
 * Manual trigger for reviews refresh (useful for testing)
 */
export const triggerManualReviewsRefresh = async (): Promise<void> => {
  try {
    console.log('🔄 Starting manual reviews refresh...');
    const reviewsService = ReviewsService.getInstance();
    const result = await reviewsService.forceRefresh();

    console.log(`✅ Manual reviews refresh completed successfully.`);
    console.log(`📊 Updated ${result.reviews.length} reviews.`);
    console.log(`⭐ Overall rating: ${result.totalRating || 'N/A'}`);
    console.log(`📝 Total review count: ${result.reviewCount || 'N/A'}`);
  } catch (error) {
    console.error('❌ Manual reviews refresh failed:', error);
    throw error;
  }
};
