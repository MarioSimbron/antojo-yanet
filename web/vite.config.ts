/**
 * Vite config: React plugin and dev server on port 5173.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
