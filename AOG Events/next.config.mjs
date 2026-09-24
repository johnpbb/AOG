/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deploys build into an idle slot (.next-a/.next-b) and repoint the .next
  // symlink only once the build succeeds, so a build killed halfway (the VPS
  // runs out of memory) never breaks the live site. `next start` runs without
  // this set and serves .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
