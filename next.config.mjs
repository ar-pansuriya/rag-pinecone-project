/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["unpdf"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
