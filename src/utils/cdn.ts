const CDN_PINCH_URL = process.env.CDN_PINCH_URL || '';
const CDN_BOB_URL = process.env.CDN_BOB_URL || '';

/** Get CDN base URL for specific brand */
const getCdnBaseForBrand = (brand?: string): string => {
  if (brand === 'pinch') return CDN_PINCH_URL;
  if (brand === 'bob') return CDN_BOB_URL;
  // Fallback to Bob's CDN if brand is not specified or unknown
  return CDN_BOB_URL;
};

/** Join key to brand-specific CDN base safely */
export const keyToCdn = (key?: string, brand?: string): string | undefined => {
  if (!key) return key;
  const cdnBase = getCdnBaseForBrand(brand);
  return `${cdnBase}/${String(key).replace(/^\/+/, '')}`;
};

/** Fallback: derive key from an S3 URL if needed */
export function s3UrlToKey(url?: string): string | undefined {
  if (!url) return undefined;
  const i = url.indexOf('.amazonaws.com/');
  if (i === -1) return undefined;
  return url.slice(i + '.amazonaws.com/'.length).replace(/^\/+/, '');
}

/** Normalize an array of multer-s3 files into { key, location: CDN } objects */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeImagesToCdn(imgs: any[], brand?: string): any[] {
  if (!Array.isArray(imgs)) return imgs;
  return imgs.map((img) => {
    const key = img?.key || s3UrlToKey(img?.location);
    return key ? { ...img, key, location: keyToCdn(key, brand) } : img;
  });
}
