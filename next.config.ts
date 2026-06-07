import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow rendering of illustrated images fetched and stored on Vercel Blob Storage.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
