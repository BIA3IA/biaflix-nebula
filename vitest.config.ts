import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __NEBULA_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
