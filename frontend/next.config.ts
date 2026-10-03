import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_EXPORT === 'true' ? 'export' : undefined,
  ...(process.env.NEXT_EXPORT === 'true'
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:4000/api/:path*',
            },
            {
              source: '/stream/:path*',
              destination: 'http://localhost:4000/stream/:path*',
            },
          ];
        },
      }),
};

export default nextConfig;
