import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { turbo: { rules: {} } },
  env: {
    NEXT_PUBLIC_FEATURE_ADMIN_UI: process.env.NEXT_PUBLIC_FEATURE_ADMIN_UI,
  },
};

export default nextConfig;
