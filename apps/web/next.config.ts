import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'pneumax.ru', pathname: '/upload/**' }],
  },
};

export default nextConfig;
