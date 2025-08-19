import ReviewsCache, { IReview } from '@src/models/reviewsModel';

/* eslint-disable camelcase */
interface GoogleReview {
  author_name: string;
  author_url?: string;
  language: string;
  original_language?: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
  translated?: boolean;
}

interface GoogleReviewsResponse {
  result: {
    reviews: GoogleReview[];
    rating?: number;
    user_ratings_total?: number;
  };
  status: string;
}
/* eslint-enable camelcase */

class ReviewsService {
  private static instance: ReviewsService;

  private readonly placeId: string;

  private readonly apiKey: string;

  constructor() {
    this.placeId = process.env.GPLACE_ID as string;
    this.apiKey = process.env.GAPI_KEY as string;

    if (!this.placeId || !this.apiKey) {
      throw new Error('Google Places API credentials not configured');
    }
  }

  public static getInstance(): ReviewsService {
    if (!ReviewsService.instance) {
      ReviewsService.instance = new ReviewsService();
    }
    return ReviewsService.instance;
  }

  /**
   * Convert Google API response format to our database format
   */
  private static transformReview(googleReview: GoogleReview): IReview {
    return {
      authorName: googleReview.author_name,
      authorUrl: googleReview.author_url,
      language: googleReview.language,
      originalLanguage: googleReview.original_language,
      profilePhotoUrl: googleReview.profile_photo_url,
      rating: googleReview.rating,
      relativeTimeDescription: googleReview.relative_time_description,
      text: googleReview.text,
      time: googleReview.time,
      translated: googleReview.translated || false,
    } as IReview;
  }

  /**
   * Fetch fresh reviews from Google Places API
   */
  private async fetchFromGoogle(): Promise<{
    reviews: IReview[];
    totalRating?: number;
    reviewCount?: number;
  }> {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${this.placeId}&key=${this.apiKey}&fields=reviews,rating,user_ratings_total`;

    const response = await fetch(apiUrl);
    const data: GoogleReviewsResponse = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const reviews =
      data.result.reviews?.map((review) =>
        ReviewsService.transformReview(review)
      ) || [];

    return {
      reviews,
      totalRating: data.result.rating,
      reviewCount: data.result.user_ratings_total,
    };
  }

  /**
   * Get cached reviews or fetch fresh ones if cache is expired
   */
  public async getReviews(): Promise<{
    reviews: IReview[];
    totalRating?: number;
    reviewCount?: number;
    fromCache: boolean;
  }> {
    // Try to get cached reviews
    let cachedReviews = await ReviewsCache.findOne({ placeId: this.placeId });

    // If no cache exists or cache is expired, fetch fresh reviews
    if (!cachedReviews || cachedReviews.needsUpdate()) {
      console.log('🔄 Fetching fresh reviews from Google Places API...');

      try {
        const freshData = await this.fetchFromGoogle();

        if (cachedReviews) {
          // Update existing cache
          cachedReviews.reviews = freshData.reviews;
          cachedReviews.totalRating = freshData.totalRating;
          cachedReviews.reviewCount = freshData.reviewCount;
          cachedReviews.scheduleNextUpdate();
          await cachedReviews.save();
        } else {
          // Create new cache
          cachedReviews = new ReviewsCache({
            placeId: this.placeId,
            reviews: freshData.reviews,
            totalRating: freshData.totalRating,
            reviewCount: freshData.reviewCount,
            lastUpdated: new Date(),
            nextUpdateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          await cachedReviews.save();
        }

        console.log(
          `✅ Reviews updated successfully. Next update due: ${cachedReviews.nextUpdateDue}`
        );

        return {
          reviews: cachedReviews.reviews,
          totalRating: cachedReviews.totalRating,
          reviewCount: cachedReviews.reviewCount,
          fromCache: false,
        };
      } catch (error) {
        console.error('❌ Failed to fetch fresh reviews from Google:', error);

        // If we have cached data, return it even if expired
        if (cachedReviews && cachedReviews.reviews.length > 0) {
          console.log('⚠️ Returning expired cached reviews due to API error');
          return {
            reviews: cachedReviews.reviews,
            totalRating: cachedReviews.totalRating,
            reviewCount: cachedReviews.reviewCount,
            fromCache: true,
          };
        }

        // If no cached data and API fails, throw error
        throw error;
      }
    }

    // Return cached reviews
    console.log(
      `📋 Returning cached reviews. Cache expires: ${cachedReviews.nextUpdateDue}`
    );
    return {
      reviews: cachedReviews.reviews,
      totalRating: cachedReviews.totalRating,
      reviewCount: cachedReviews.reviewCount,
      fromCache: true,
    };
  }

  /**
   * Force refresh reviews from Google Places API
   */
  public async forceRefresh(): Promise<{
    reviews: IReview[];
    totalRating?: number;
    reviewCount?: number;
  }> {
    console.log('🔄 Force refreshing reviews from Google Places API...');

    const freshData = await this.fetchFromGoogle();

    // Update or create cache
    await ReviewsCache.findOneAndUpdate(
      { placeId: this.placeId },
      {
        reviews: freshData.reviews,
        totalRating: freshData.totalRating,
        reviewCount: freshData.reviewCount,
        lastUpdated: new Date(),
        nextUpdateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );

    console.log('✅ Reviews force refreshed successfully');
    return freshData;
  }

  /**
   * Get cache status and stats
   */
  public async getCacheStatus(): Promise<{
    exists: boolean;
    lastUpdated?: Date;
    nextUpdateDue?: Date;
    reviewCount?: number;
    needsUpdate?: boolean;
  } | null> {
    const cachedReviews = await ReviewsCache.findOne({ placeId: this.placeId });

    if (!cachedReviews) {
      return { exists: false };
    }

    return {
      exists: true,
      lastUpdated: cachedReviews.lastUpdated,
      nextUpdateDue: cachedReviews.nextUpdateDue,
      reviewCount: cachedReviews.reviews.length,
      needsUpdate: cachedReviews.needsUpdate(),
    };
  }
}

export default ReviewsService;
