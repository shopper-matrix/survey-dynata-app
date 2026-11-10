import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of every respondent path (DSA-702). Locally they run against the running
// app (`docker compose up`); in CI Playwright starts API and web itself. E2E_BASE_URL points
// them at another environment (staging), whose settings must then be in the environment.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI, staging).
}

const baseURL = process.env.E2E_BASE_URL ?? process.env.APP_BASE_URL ?? 'http://localhost:5173';
const startServers = process.env.E2E_BASE_URL === undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Reuses servers that already run (docker compose); starts them otherwise (CI).
  ...(startServers
    ? {
        webServer: [
          {
            command: 'pnpm --filter @survey-dynata/api dev',
            url: 'http://localhost:3000/health',
            reuseExistingServer: true,
            cwd: '..',
          },
          {
            command: 'pnpm --filter @survey-dynata/web dev',
            url: 'http://localhost:5173',
            reuseExistingServer: true,
            cwd: '..',
          },
        ],
      }
    : {}),
});
