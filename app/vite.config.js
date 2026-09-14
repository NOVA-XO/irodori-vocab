import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — GitHub Pages нь дэд замд ч ажиллана (харьцангуй хаяг).
// outDir нь төслийн `dist/` — үндэс рүү зөвхөн батлагдсаны дараа залгана.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
});
