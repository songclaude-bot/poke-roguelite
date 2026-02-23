import { defineConfig } from "vite";

export default defineConfig({
  base: "/poke-roguelite/",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  server: {
    host: "0.0.0.0",
    port: 3001,
  },
});
