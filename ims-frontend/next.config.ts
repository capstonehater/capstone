import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Production uses Turbopack; the Webpack hook below is development-only.
  turbopack: {},
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
