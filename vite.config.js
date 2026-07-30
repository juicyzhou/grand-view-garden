import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    watch: {
      // 原子写入（tmp+rename）可能让默认 watcher 漏掉变更，轮询更可靠
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});

