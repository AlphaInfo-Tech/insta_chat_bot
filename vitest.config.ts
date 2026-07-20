import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@/types': path.resolve(__dirname, 'types'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/database': path.resolve(__dirname, 'database'),
      '@/repositories': path.resolve(__dirname, 'repositories'),
      '@/services': path.resolve(__dirname, 'services'),
      '@/utils': path.resolve(__dirname, 'utils'),
      '@/prompts': path.resolve(__dirname, 'prompts'),
    },
  },
});
