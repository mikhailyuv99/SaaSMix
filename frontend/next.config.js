/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "connect-src 'self' https://api.siberiamix.com https://api-staging.siberiamix.com https://js.stripe.com",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' blob: https://api.siberiamix.com https://api-staging.siberiamix.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
