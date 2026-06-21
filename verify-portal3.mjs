import { chromium } from '/home/po/me/bts/legal-editor-20250403/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true, executablePath: '/home/po/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

// Login with phone number
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('#identifier', '09959888888');  // phone number from email prefix
await page.fill('#password', 'password123');
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
console.log('After login URL:', page.url());

if (page.url().includes('/login')) {
  // Try different password
  await page.fill('#identifier', '09959888888');
  await page.fill('#password', '123456');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
  console.log('After second login URL:', page.url());
}

if (!page.url().includes('/login')) {
  await page.goto('http://localhost:3000/portal', { waitUntil: 'networkidle' });
  console.log('Portal URL:', page.url());
  await page.screenshot({ path: 'portal-final.png', fullPage: true });
  
  const sections = await page.$$eval('.pd-sec-title', els => els.map(e => e.textContent)).catch(() => []);
  const hasStickybar = await page.$('.pd-stickybar');
  const navLinks = await page.$$eval('nav a', els => els.map(a => ({ text: a.textContent?.trim(), href: a.href }))).catch(() => []);
  console.log('Sections:', sections);
  console.log('Has stickybar:', !!hasStickybar);
  console.log('Nav links:', JSON.stringify(navLinks));
  console.log('Console errors:', errors);
} else {
  const body = await page.$eval('body', el => el.innerText.substring(0, 200));
  console.log('Still on login:', body);
}

await browser.close();
