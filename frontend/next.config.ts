import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false,

  // ─── Standalone output for production deployment (VPS/cPanel/Docker) ───
  output: "standalone",

  // ─── Fix: Tell Turbopack where the workspace root is ────────────────────
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },

  // ─── Package import optimisations ────────────────────────────────────────
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "xlsx"],
  },

  // ─── API proxy rewrites to NestJS backend ────────────────────────────────
  async rewrites() {
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:3000";
    const backendUrl = rawBackendUrl.replace(/\/api\/?$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // ─── Disable x-powered-by header for security ────────────────────────────
  poweredByHeader: false,

  // ─── Compress responses ───────────────────────────────────────────────────
  compress: true,
};

export default nextConfig;
