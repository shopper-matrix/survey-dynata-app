import { defineConfig } from 'vitest/config';

// Coverage of the modules that decide billing outcomes (DSA-701): Dynata links, quotas and
// quality checks must stay at 90% or more. Measured by `pnpm test:coverage`, which also runs
// the database tests (CI provides the database).
const CORE = 90;
const core = { lines: CORE, functions: CORE, branches: CORE, statements: CORE };

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/dynata/**/*.ts', 'src/quotas/**/*.ts', 'src/quality/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        'src/dynata/**/*.ts': core,
        'src/quotas/**/*.ts': core,
        'src/quality/**/*.ts': core,
      },
    },
  },
});
