const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const browserUse = {
  baseURL: 'http://127.0.0.1:4173',
  browserName: 'chromium',
  timezoneId: 'Asia/Seoul',
  locale: 'ko-KR',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
  trace: 'retain-on-failure'
};

module.exports = defineConfig({
  testDir: '../tests',
  testMatch: '**/visual-baseline.spec.js',
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005 } },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: browserUse,
  projects: [
    { name: 'desktop-baseline', use: { viewport: {width:1440,height:900} } },
    { name: 'mobile-baseline', use: { viewport: {width:390,height:844}, isMobile:true, hasTouch:true } },
    { name: 'narrow-baseline', use: { viewport: {width:320,height:568}, isMobile:true, hasTouch:true } }
  ],
  webServer: {
    command: 'node scripts/serve.js',
    cwd: root,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
