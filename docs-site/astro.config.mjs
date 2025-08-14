// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://luq.dev',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    mdx(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      langs: [],
    },
  },
  prefetch: {
    prefetchAll: true,
  },
  // Vite configuration for better HMR
  vite: {
    server: {
      hmr: {
        overlay: true, // Show error overlay
        port: 24678, // Specific port for HMR websocket
      },
      watch: {
        usePolling: true, // Better file watching in WSL/Docker
        interval: 100, // Check for changes every 100ms
      },
    },
    optimizeDeps: {
      exclude: ['astro', '@astrojs/tailwind'], // Exclude from pre-bundling for faster HMR
    },
  },
  // Development server configuration
  server: {
    port: 4321,
    host: true, // Listen on all addresses
  },
});
