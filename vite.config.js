import { defineConfig } from 'vite';
import stashApi from './server/api.js';

export default defineConfig({
  plugins: [stashApi()],
  // es2022 so src/main.js can use top-level await while loading from the DB.
  build: { target: 'es2022' },
});
