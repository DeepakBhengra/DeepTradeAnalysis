/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        timeout: 900_000,
        proxyTimeout: 900_000,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            if ("headersSent" in res && !res.headersSent && "writeHead" in res) {
              res.writeHead(503, { "Content-Type": "application/json" });
            }
            if ("end" in res) {
              res.end(
                JSON.stringify({
                  error:
                    "Cannot reach the API on port 3001. Start both servers with: npm run dev:dashboard",
                }),
              );
            }
          });
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/test/setup.ts",
  },
});
