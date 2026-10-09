import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Excel generation uses Node streams; load it with plain Node instead of bundling.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
