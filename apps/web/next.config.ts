import type { NextConfig } from 'next';

// Хост и путь берутся из shared/config/productImage.ts — единственного
// источника правды, тем же значением пользуется валидация в форме товара.
// См. комментарий там.
import { PRODUCT_IMAGE_REMOTE_PATTERN } from './src/shared/config/productImage';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [PRODUCT_IMAGE_REMOTE_PATTERN],
  },
};

export default nextConfig;
