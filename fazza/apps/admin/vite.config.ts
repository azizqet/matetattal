import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@fazza/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)) } },
  server: { port: 5173, fs: { allow: ["../.."] } },
  build: { sourcemap: false, target: "es2022" },
});
