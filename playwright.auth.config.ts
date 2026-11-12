import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  outputDir: './test-results/auth',
  testDir: './tests/auth-e2e', workers: 1, fullyParallel: false, retries: 0,
  reporter: [['list']], timeout: 30000,
  use: { trace: 'off', video: 'off', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  projects: [{ name: 'auth-desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'auth-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
})
