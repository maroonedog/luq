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

  // English is the default and keeps the bare paths, so every URL that is
  // already published still resolves and nothing moves. Japanese is prefixed:
  // /ja/benchmarks beside /benchmarks.
  //
  // Declaring a locale here creates no page for it — Astro routes what exists
  // in src/pages and 404s the rest. Which Japanese pages exist is held in
  // src/i18n/translated-paths.ts, and that is what the language switch reads
  // so it cannot point at a route nobody wrote.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    routing: { prefixDefaultLocale: false },
  },
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
