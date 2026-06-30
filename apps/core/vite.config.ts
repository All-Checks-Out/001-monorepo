import path from "path";
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/core/",
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "core",
      filename: "remoteEntry.js",
      exposes: {
        "./app": "./src/remote.tsx",
      },
      shared: {
        "@frontend/auth/session/AuthProvider": { singleton: true },
        "@frontend/auth/session/ThemeProvider": { singleton: true },
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom/client": { singleton: true, requiredVersion: "^19.0.0" },
        "react-router-dom": { singleton: true, requiredVersion: "7.13.1" },
      },
    }),
  ],
  server: {
    origin: "http://localhost:5174",
    port: 5174,
    strictPort: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
