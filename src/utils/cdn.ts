const CDN_BASE_URL =
  process.env.CDN_BASE_URL || 'https://d12ajhxb7wc0mr.cloudfront.net';

/** Join key to CDN base safely (no brand prefix needed) */
export const keyToCdn = (key?: string): string | undefined => {
  if (!key) return key;

  // Clean the key and ensure it doesn't start with slash
  const cleanKey = String(key).replace(/^\/+/, '');

  // Return CDN URL without brand prefix
  return `${CDN_BASE_URL}/${cleanKey}`;
};

/** Derive key from an S3 URL and convert to CDN URL */
export function s3UrlToKey(url?: string): string | undefined {
  if (!url) return undefined;

  // Check if already a CDN URL
  if (url.includes('cloudfront.net')) {
    return url;
  }

  // Extract key from S3 URL - handle different S3 URL formats
  const s3Pattern = /\.s3[.-][\w-]*\.amazonaws\.com\/(.*)/;
  const match = url.match(s3Pattern);

  if (match && match[1]) {
    const key = match[1].replace(/^\/+/, '');
    return keyToCdn(key);
  }

  return undefined;
}

/** Normalize an array of multer-s3 files into { key, location: CDN } objects */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeImagesToCdn(imgs: any[]): any[] {
  if (!Array.isArray(imgs)) return imgs;
  return imgs.map((img) => {
    // If img is a string (URL from frontend)
    if (typeof img === 'string') {
      const cdnUrl = s3UrlToKey(img) || img;
      return cdnUrl;
    }

    // If img is an object with key or location
    const key = img?.key || s3UrlToKey(img?.location);
    return key ? { ...img, key, location: keyToCdn(key) } : img;
  });
}
