import path from "path";
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      federation({
        name: "shell",
        filename: "remoteEntry.js",
        remotes: {
          core: {
            type: "module",
            name: "core",
            entry: env.VITE_CORE_REMOTE_ENTRY_URL,
            entryGlobalName: "core",
            shareScope: "default",
          },
          form_design: {
            type: "module",
            name: "form_design",
            entry: env.VITE_FORM_DESIGN_REMOTE_ENTRY_URL,
            entryGlobalName: "form_design",
            shareScope: "default",
          },
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
      origin: "http://localhost:5173",
      port: 5173,
      strictPort: true,
    },
    resolve: {
      dedupe: ["react", "react-dom", "react-dom/client", "react-router-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
