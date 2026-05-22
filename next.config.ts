import type { NextConfig } from "next";

// API proxy target for the ``/api/v1/*`` rewrite.
//
//   * On Vercel (``process.env.VERCEL`` is automatically set to "1"
//     in build and runtime): point at the public Azure Container Apps
//     custom-domain ``api.lexhaiti.org``. Hardcoded so a misconfigured
//     or missing env var can't degrade prod to a localhost rewrite —
//     which was the cause of the ``DNS_HOSTNAME_RESOLVED_PRIVATE``
//     errors that rendered every law-detail page as ``Page introuvable``
//     even though the backend was healthy.
//   * Off Vercel (local dev, CI builds): honour
//     ``LEXHAITI_API_INTERNAL_URL`` when set; default to the local
//     uvicorn on ``http://localhost:8000``.
const API_TARGET = process.env.VERCEL
  ? "https://api.lexhaiti.org"
  : (process.env.LEXHAITI_API_INTERNAL_URL ?? "http://localhost:8000");

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Builds are now type-checked. The codebase passes ``npx tsc
  // --noEmit`` on every save; flipping ``ignoreBuildErrors`` off
  // makes that contract enforceable in CI / production builds too.
  // If a type error sneaks in, ``npm run build`` will fail rather
  // than ship a broken bundle.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Don't rewrite trailing slashes — FastAPI's collection routes end with `/`
  // and the proxy must pass URLs through verbatim.
  skipTrailingSlashRedirect: true,
  // Proxy /api/v1/* to the FastAPI backend so the browser sees one origin
  // (localhost:3000). This lets Auth.js cookies travel to backend requests
  // without CORS gymnastics.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
