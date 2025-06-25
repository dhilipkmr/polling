import puppeteer from "puppeteer";

const DEFAULT_LAUNCH_OPTIONS = {
  headless: "new",
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920x1080',
  ]
};
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DEFAULT_EXTRA_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Launch Puppeteer browser and page with retry logic and default config.
 * @param {object} launchOptions - Options to pass to puppeteer.launch().
 * @param {number} maxRetries - Number of retry attempts.
 * @param {number} retryDelayMs - Delay between retries in milliseconds.
 * @param {object} pageOptions - Optional overrides for userAgent, extraHeaders, viewport.
 * @returns {Promise<{browser: import('puppeteer').Browser, page: import('puppeteer').Page}>}
 */
export async function launchPuppeteerWithRetry(
  launchOptions = {},
  maxRetries = 3,
  retryDelayMs = 5000,
  pageOptions = {}
) {
  let attempt = 0;
  let lastError;
  // Merge user options with defaults (user options take precedence)
  const mergedOptions = { ...DEFAULT_LAUNCH_OPTIONS, ...launchOptions };
  if (DEFAULT_LAUNCH_OPTIONS.args && launchOptions.args) {
    mergedOptions.args = [
      ...DEFAULT_LAUNCH_OPTIONS.args,
      ...launchOptions.args.filter(arg => !DEFAULT_LAUNCH_OPTIONS.args.includes(arg))
    ];
  }
  while (attempt < maxRetries) {
    try {
      const browser = await puppeteer.launch(mergedOptions);
      const page = await browser.newPage();
      await page.setUserAgent(pageOptions.userAgent || DEFAULT_USER_AGENT);
      await page.setExtraHTTPHeaders(pageOptions.extraHeaders || DEFAULT_EXTRA_HEADERS);
      await page.setViewport(pageOptions.viewport || DEFAULT_VIEWPORT);
      return { browser, page };
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt < maxRetries) {
        console.error(`Puppeteer launch failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw new Error(`Failed to launch Puppeteer after ${maxRetries} attempts: ${lastError?.message}`);
}
