/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@anthropic/fingerprint-client'],
}

module.exports = nextConfig
