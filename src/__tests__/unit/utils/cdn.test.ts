import { keyToCdn } from '@src/utils/cdn';

describe('CDN Utils', () => {
  it('converts key to CDN URL', () => {
    const url = keyToCdn('products/cake.jpg');
    expect(url).toBe('https://test-cdn.cloudfront.net/products/cake.jpg');
  });
});
