const withPWA = require("next-pwa")({
  dest: "public",
  // Keep disabled by default to avoid stale service-worker UI cache.
  disable: process.env.ENABLE_PWA !== "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
