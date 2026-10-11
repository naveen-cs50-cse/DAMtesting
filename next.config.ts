import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['http://localhost:3000', '192.168.56.1', 'http://localhost:8080', 'http://[IP_ADDRESS]'],
  crossOrigin: 'anonymous',
};

export default nextConfig;
