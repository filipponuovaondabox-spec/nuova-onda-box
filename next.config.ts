import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the frontend is deployed on Cloudflare Pages as static
  // assets (see wrangler.toml -> pages_build_output_dir = "out").
  // The backend API lives in Cloudflare Pages Functions (functions/ directory)
  // backed by Cloudflare D1 (binding "DB").
  output: "export",
};

export default nextConfig;
