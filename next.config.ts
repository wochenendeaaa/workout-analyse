import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /** Sollte mit Server-Limit (MAX_PDF_MB bzw. Vercel-Default) übereinstimmen. */
    NEXT_PUBLIC_MAX_UPLOAD_MB:
      process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ??
      (process.env.VERCEL ? "4" : "50"),
  },
};

export default nextConfig;
