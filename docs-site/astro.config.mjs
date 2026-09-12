// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://luq.dev',
  // Tailwind is a Vite plugin rather than an Astro integration: @astrojs/tailwind
  // stops at astro ^5, and Tailwind 4 is wired through Vite instead. The
  // integration's `applyBaseStyles: false` has no equivalent and needs none —
  // global.css decides what it imports, and it does not import preflight.
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      langs: [],
    },
  },
  prefetch: {
    prefetchAll: true,
  },
  vite: {
    plugins: [tailwindcss()],
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
      exclude: ['astro'], // Exclude from pre-bundling for faster HMR
    },
  },
  // Development server configuration
  server: {
    port: 4321,
    host: true, // Listen on all addresses
  },
});
