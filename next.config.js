/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  output: "standalone",
  webpack: (config, { isServer, webpack }) => {
    const path = require("path")
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native": false,
      "react-native-fs": false,
      "react-native-fetch-blob": false,
    }
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    }
    return config
  },
}
module.exports = nextConfig
