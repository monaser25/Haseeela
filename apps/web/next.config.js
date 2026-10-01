/** @type {import('next').NextConfig} */
const withSerwistInit = require('@serwist/next').default;

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: false,
  reloadOnOnline: false,
  // Disable the service worker in development so HMR + Next.js error overlay
  // keep working. The production build still emits and registers it.
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@haseela/shared'],
};

module.exports = withSerwist(nextConfig);
