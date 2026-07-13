import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*', // Proxy to backend
      },
      {
        source: '/stream/:path*',
        destination: 'http://localhost:4000/stream/:path*', // Proxy stream to backend
      },
    ];
  },
};

export default nextConfig;
