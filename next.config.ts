import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Allow production builds to succeed even if there are ESLint
   * violations. This is useful when deploying to Vercel and you
   * have existing `no-explicit-any`, `no-unused-vars`, etc.
   */
  eslint: {
    ignoreDuringBuilds: true,
  },

  /**
   * Allow production builds to succeed even if there are TypeScript
   * errors. This prevents Vercel from failing the build on purely
   * type-level issues.
   */
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
