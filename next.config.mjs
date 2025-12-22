import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ignora erros de ESLint durante o build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignora erros de TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);