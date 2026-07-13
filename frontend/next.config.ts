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
        // Menggunakan sintaks regex parameter next.config agar tidak mengalami konflik titik dua (::) saat di-build
        destination: 'http://localhost/:path*?__stream_port=:port', // Akan di-override/ditangani dengan rapi, namun cara terbaik di bawah:
      },
    ];
  },
};

export default nextConfig;
