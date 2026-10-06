import type { NextConfig } from "next";

const profilePictureOrigin = new URL(
  `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "")}/profile-picture/*`,
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [profilePictureOrigin],
    // Local self-hosting uses the backend on loopback. External deployments
    // retain Next's private-IP protection; redirects are always disabled.
    dangerouslyAllowLocalIP: ["localhost", "127.0.0.1", "[::1]"].includes(profilePictureOrigin.hostname),
    maximumRedirects: 0,
    imageSizes: [32, 40, 48, 64, 80, 96, 128, 256, 384],
  },
  reactCompiler: true,
  turbopack: {},
  experimental: {
    // Reuse compiler work across production builds after source updates.
    turbopackFileSystemCacheForBuild: true,
  },
  webpack(config, { dev, isServer }) {
    if (dev && !isServer) {
      config.module.rules.push({
        test: /mini-css-extract-plugin[\\/]hmr[\\/]hotModuleReplacement\.js$/,
        enforce: "pre",
        use: [require.resolve("./scripts/css-hmr-cleanup-loader.cjs")],
      });
    }
    return config;
  },
};

export default nextConfig;
