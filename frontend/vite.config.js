import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Proxy /api during development so the browser sees a same-origin API and
    // CORS never enters the picture locally.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },

  build: {
    // Split the big third-party libraries out of the app bundle so a code
    // change doesn't invalidate the vendor cache on every deploy.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-motion": ["framer-motion"],
          "vendor-utils": ["axios", "date-fns", "react-hook-form", "react-hot-toast"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
