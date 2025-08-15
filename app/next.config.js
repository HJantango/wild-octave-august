const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Only use static export if explicitly requested, otherwise use default SSR/SSG
  output: process.env.NEXT_OUTPUT_MODE === 'export' ? 'export' : undefined,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Ensure proper hydration for interactive components
  reactStrictMode: true,
  // Optimize for better client-side performance
  swcMinify: true,
  // Fix hydration issues
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  // Ensure proper client-side hydration
  poweredByHeader: false,
};

module.exports = nextConfig;
