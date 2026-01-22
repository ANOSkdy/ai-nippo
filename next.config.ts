import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure server/RSC analysis does not try to bundle 'airtable' into Edge.
  serverExternalPackages: ['airtable', 'exceljs'],
  async redirects() {
    return [
      {
        source: '/reports/work',
        destination: '/reports',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
