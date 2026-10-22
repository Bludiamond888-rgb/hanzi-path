import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e', timeout: 180_000, reporter: 'list',
  use: { ...devices['iPhone 14'], baseURL: 'http://localhost:4173/' },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 14'] } }],
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
