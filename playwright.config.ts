import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 5_000 },
  reporter: [['list'],['html',{open:'never'}]],
  use: { baseURL:process.env.GAME_URL || 'http://127.0.0.1:5173', trace:'retain-on-failure', screenshot:'only-on-failure' },
  webServer:process.env.GAME_URL ? undefined : {command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
  projects:[
    // CI uses a software GPU. Keep real WebGL and responsive layout checks, at a smaller raster size.
    // Local visual QA retains the large desktop viewport and native mobile density.
    {name:'Desktop Chrome',use:{...devices['Desktop Chrome'],channel:process.env.CI ? undefined : 'chrome',viewport:process.env.CI ? {width:960,height:720} : {width:1440,height:900}}},
    {name:'Desktop WebKit',use:{...devices['Desktop Safari'],viewport:process.env.CI ? {width:960,height:720} : {width:1440,height:900}}},
    {name:'iPhone WebKit',use:{...devices['iPhone 13'],deviceScaleFactor:process.env.CI ? 1 : devices['iPhone 13'].deviceScaleFactor}},
    {name:'Android Chrome',use:{...devices['Pixel 7'],channel:process.env.CI ? undefined : 'chrome',deviceScaleFactor:process.env.CI ? 1 : devices['Pixel 7'].deviceScaleFactor}}
  ]
});
