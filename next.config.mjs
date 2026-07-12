import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const publicSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
];

const cspHeader = {
  key: "Content-Security-Policy",
  value:
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; worker-src 'self'; manifest-src 'self';",
};

const nextConfig = {
  async headers() {
    const withCsp = [...publicSecurityHeaders, cspHeader];
    return [
      { source: "/:path*", headers: withCsp },
      { source: "/agendar/:path*", headers: publicSecurityHeaders },
      { source: "/portal/:path*", headers: publicSecurityHeaders },
      { source: "/nps/:path*", headers: publicSecurityHeaders },
      { source: "/teleconsulta/:path*", headers: publicSecurityHeaders },
      { source: "/m/:path*", headers: publicSecurityHeaders },
      { source: "/lp/:path*", headers: publicSecurityHeaders },
      { source: "/c/:path*", headers: publicSecurityHeaders },
      { source: "/r/:path*", headers: publicSecurityHeaders },
    ];
  },
};

export default withSerwist(nextConfig);
