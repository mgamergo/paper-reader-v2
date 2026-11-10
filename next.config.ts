import type { NextConfig } from "next";
const config: NextConfig = { serverExternalPackages: ["pdfjs-dist"], experimental: { serverActions: { bodySizeLimit: "25mb" } } };
export default config;
