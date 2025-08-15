const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Force dynamic rendering for all pages to avoid build-time database calls
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Ignore missing modules during build
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  images: { unoptimized: true },
  reactStrictMode: false,
  swcMinify: true,
  poweredByHeader: false,
  // Skip static optimization for pages that need database access
  async generateStaticParams() {
    return []
  }
};

module.exports = nextConfig;
