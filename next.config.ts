import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {source:"/hotel/:path*",headers:[
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"X-Robots-Tag",value:"noindex, nofollow"},
        {key:"Cache-Control",value:"private, no-store"},
      ]},
      {source:"/hotel-admin/:path*",headers:[
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"X-Robots-Tag",value:"noindex, nofollow"},
      ]},
    ];
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
    // New 10 MiB videos upload directly to Blob, bypassing the 4.5 MB request cap.
    // Keep multipart Server Actions under the platform request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
