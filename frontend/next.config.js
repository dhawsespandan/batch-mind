/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      '@': '.',
    },
  },
}

module.exports = nextConfig