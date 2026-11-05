import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser', fullyParallel: true, workers: 2, timeout: 20000,
    use: { baseURL: 'http://127.0.0.1:4187', viewport: { width: 1200, height: 900 }, trace: 'retain-on-failure' },
    webServer: { command: 'node tests/server.mjs', url: 'http://127.0.0.1:4187', reuseExistingServer: false },
});
