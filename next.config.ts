import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true, // Disabling temporarily to ensure stability
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

};

export default nextConfig;
