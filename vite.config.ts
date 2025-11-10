import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

// Plugin to move HTML files to correct locations and fix paths after build
const moveHtmlFiles = () => {
  return {
    name: "move-html-files",
    closeBundle() {
      const distDir = resolve(__dirname, "dist");
      const srcPopupHtml = join(distDir, "src/popup/index.html");
      const srcOptionsHtml = join(distDir, "src/options/index.html");
      const srcCardPopupHtml = join(distDir, "src/cardPopup/index.html");
      const popupDir = join(distDir, "popup");
      const optionsDir = join(distDir, "options");
      const cardPopupDir = join(distDir, "cardPopup");
      // Move and fix popup HTML
      if (existsSync(srcPopupHtml)) {
        if (!existsSync(popupDir)) mkdirSync(popupDir, { recursive: true });
        let content = readFileSync(srcPopupHtml, "utf-8");
        // Fix absolute paths to relative paths
        content = content.replace(/src="\/assets\//g, 'src="../assets/');
        content = content.replace(/href="\/assets\//g, 'href="../assets/');
        writeFileSync(join(popupDir, "index.html"), content);
      }
      
      // Move and fix options HTML
      if (existsSync(srcOptionsHtml)) {
        if (!existsSync(optionsDir)) mkdirSync(optionsDir, { recursive: true });
        let content = readFileSync(srcOptionsHtml, "utf-8");
        // Fix absolute paths to relative paths
        content = content.replace(/src="\/assets\//g, 'src="../assets/');
        content = content.replace(/href="\/assets\//g, 'href="../assets/');
        writeFileSync(join(optionsDir, "index.html"), content);
      }
      
      // Move and fix cardPopup HTML
      if (existsSync(srcCardPopupHtml)) {
        if (!existsSync(cardPopupDir)) mkdirSync(cardPopupDir, { recursive: true });
        let content = readFileSync(srcCardPopupHtml, "utf-8");
        // Fix absolute paths to relative paths
        content = content.replace(/src="\/assets\//g, 'src="../assets/');
        content = content.replace(/href="\/assets\//g, 'href="../assets/');
        writeFileSync(join(cardPopupDir, "index.html"), content);
      }
      
      // Clean up old src directories
      const srcDir = join(distDir, "src");
      if (existsSync(srcDir)) {
        rmSync(srcDir, { recursive: true, force: true });
      }
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "manifest.json",
          dest: "."
        }
      ]
    }),
    moveHtmlFiles()
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
        background: resolve(__dirname, "src/background/background.ts"),
        cardPopup: resolve(__dirname, "src/cardPopup/index.html"),
        contentCardPopup: resolve(__dirname, "src/content/cardPopup.ts")
      },
      output: {
        entryFileNames: (assetInfo) => {
          if (assetInfo.name === "background") {
            return "background/[name].js";
          }
          if (assetInfo.name === "contentCardPopup") {
            return "content/[name].js";
          }
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          // Keep HTML files in their respective directories
          if (assetInfo.name && assetInfo.name.includes("popup")) {
            return "popup/[name][extname]";
          }
          if (assetInfo.name && assetInfo.name.includes("options")) {
            return "options/[name][extname]";
          }
          if (assetInfo.name && assetInfo.name.includes("cardPopup")) {
            return "cardPopup/[name][extname]";
          }
          return "assets/[name][extname]";
        }
      }
    },
    sourcemap: true
  }
});
