import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ========================================================================
  // PERFORMANCE OPTIMIZATIONS
  // ========================================================================

  // Enable React strict mode for better development checks
  reactStrictMode: true,

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Disable canvas for PDF.js (not needed in Node)
    config.resolve.alias.canvas = false;

    // Optimize Three.js imports
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Prevent importing entire three.js bundle
        three: 'three',
      };
    }

    // Enable WebAssembly for Draco decoder
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },

  // ========================================================================
  // IMAGE OPTIMIZATION
  // ========================================================================

  images: {
    // Allow images from these domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
    // Use modern formats
    formats: ['image/avif', 'image/webp'],
  },

  // ========================================================================
  // SECURITY HEADERS
  // ========================================================================

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS Protection
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy (disable unnecessary APIs)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Allow cross-origin for 3D assets
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },

  // ========================================================================
  // COMPRESSION & CACHING
  // ========================================================================

  // Enable compression
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // ========================================================================
  // BUILD OPTIMIZATION
  // ========================================================================

  // Disable x-powered-by header
  poweredByHeader: false,

  // Experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      '@react-three/fiber',
      '@react-three/drei',
      'three',
    ],
  },
};

export default nextConfig;
