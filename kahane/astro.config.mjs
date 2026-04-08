// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://kahane-coaching.vercel.app',
  vite: {
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
  },
});