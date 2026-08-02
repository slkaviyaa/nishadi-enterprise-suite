/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Next.js App එක Static HTML/JS බවට Export කරයි
  images: { unoptimized: true },
}

module.exports = nextConfig