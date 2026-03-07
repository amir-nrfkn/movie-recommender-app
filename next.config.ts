/**
 * Next.js configuration for SceneIt.
 *
 * Key decisions:
 * - output: 'standalone' for containerized deployments (AI Studio / Cloud Run)
 * - turbopack: {} to acknowledge Next.js 16 Turbopack default while keeping
 *   the webpack fallback for the HMR-disable behavior used by AI Studio
 * - transpilePackages: ['motion'] to ensure the motion library is bundled correctly
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  // Next.js 16 uses Turbopack by default. An empty config here tells it to
  // accept the webpack fallback below without erroring during builds.
  turbopack: {},
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify — file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
