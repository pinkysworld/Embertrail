import { defineConfig } from "vite";
import path from "node:path";

// GitHub Pages project site: https://pinkysworld.github.io/Embertrail/
const isPages = process.env.GITHUB_PAGES === "true" || process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  root: ".",
  publicDir: "public",
  base: isPages ? "/Embertrail/" : "/",
  resolve: {
    alias: {
      "@embertrail/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@embertrail/rules": path.resolve(__dirname, "../../packages/rules/src/index.ts"),
      "@embertrail/content": path.resolve(__dirname, "../../packages/content/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:2567",
      "/colyseus": {
        target: "ws://localhost:2567",
        ws: true,
      },
    },
  },
});
