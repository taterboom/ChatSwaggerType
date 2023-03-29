/** @type {import('next').NextConfig} */

const isExtension = process.env.NEXT_PUBLIC_IS_EXTENSION === "true"

const nextConfig = {
  // experimental: {
  //   appDir: true,
  // },
  ...(isExtension ? { output: "export", distDir: "dist/out", assetPrefix: "./" } : undefined),
}

console.log("nextConfig.output", nextConfig.output)

module.exports = nextConfig
