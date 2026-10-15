import { defineConfig } from 'vitest/config';

// Unit tests for the shared rules, bot and progression maths. They run in plain Node and
// need neither the browser nor the Cloudflare runtime.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
