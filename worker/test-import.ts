import type { BrowserContextOptions, LaunchOptions, Page } from 'playwright';
import { chromium } from 'playwright';

const opts: LaunchOptions = { headless: true };
const ctxOpts: BrowserContextOptions = { viewport: { width: 800, height: 600 } };
console.log('ok');
