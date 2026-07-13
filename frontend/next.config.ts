import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*', // Proxy to backend
      },
      {
        source: '/stream/:port/:path*',
        destination: 'http://127.0.0.1::port/:path*', // Proxy to V380Decoder specific camera port (e.g. 8080, 8081)
      },
    ];
  },
};

export default nextConfig;
