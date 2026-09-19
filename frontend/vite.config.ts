import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Custom plugin to copy ../data into dist/data on build
function copyDataPlugin() {
  return {
    name: 'copy-data-dir',
    closeBundle: async () => {
      const srcDir = path.resolve(__dirname, '../data');
      const destDir = path.resolve(__dirname, 'dist/data');

      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log('[Vite Build] Successfully copied data/ into dist/data/');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyDataPlugin()],
  base: './',
  server: {
    port: 3000,
    fs: {
      // Allow serving files from the project root data directory
      allow: ['..']
    }
  }
});
