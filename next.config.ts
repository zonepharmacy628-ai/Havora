import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Images are served straight from the Unsplash / Cloudinary CDNs, which resize on the fly.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The separate customer dashboard was removed; its old addresses lead to the
  // ordinary site pages that replaced them. (/account/settings is role-aware, see its page.)
  async redirects() {
    return [
      { source: "/account", destination: "/bookings", permanent: false },
      { source: "/account/bookings", destination: "/bookings", permanent: false },
      { source: "/account/reviews", destination: "/bookings", permanent: false },
      { source: "/account/wishlist", destination: "/wishlist", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
