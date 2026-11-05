import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'html',
	timeout: 30_000,
	expect: {
		timeout: 5_000
	},
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev -- --port 5173',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			// The rig's TONE3000 test fakes TONE3000 itself, so any key will do
			PUBLIC_TONE3000_CLIENT_ID: process.env.PUBLIC_TONE3000_CLIENT_ID || 't3k_pub_e2e'
		}
	}
});
