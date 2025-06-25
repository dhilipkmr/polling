import dotenv from 'dotenv';
import * as cheerio from "cheerio";
import { launchPuppeteerWithRetry } from "../utils/launchPupeteer.js";
import { waitAndInitiateScrape } from "./findTopDiscountedDeals.js";
import { sendNotification } from "../notifications/telegram.js";
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['BOT_ID', 'CHAT_ID', 'URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

let previousDiscount = 0;

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

export async function checkMyntraDiscount() {
  let browser = null;
  let page = null;
  const maxRetries = 3;

  try {
    console.log(`🔍 Checking for BLINKDEAL...`);
    const { page } = await launchPuppeteerWithRetry();

    // Navigate with timeout and wait until network is idle
    await page.goto(process.env.URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 // 30 seconds timeout
    });
    // Wait for the product selector to appear
    try {
      await page.waitForSelector('.product-base a', { timeout: 15000 });
    } catch (waitError) {
      console.warn('⚠️ .product-base a selector not found after waiting. Dumping HTML for debugging.');
      const html = await page.content();
      console.log(html);
    }

    try {
      const productUrl = await page.evaluate(() => {
        const link = document.querySelector('.product-base a');
        return link ? link.getAttribute('href') : null;
      });

      if (productUrl) {
        const fullUrl = new URL(productUrl, 'https://www.myntra.com').toString();
        console.log('🔗 Navigating to product URL:', fullUrl);
        
        await page.goto(fullUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Wait for any network activity to settle and content to stabilize
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
        console.log('✅ Page content stabilized after navigation');
      } else {
        const html = await page.content();
        console.warn('⚠️ Could not find product URL. Dumping HTML for debugging.');
        console.log(html);
      }
    } catch (urlError) {
      console.log('⚠️ Error while handling product URL:', urlError.message);
    }
    
    const content = await page.content();
    const $ = cheerio.load(content);

    // Check for BLINKDEAL and discount
    const blinkDealElement = $('.pdp-offers-boldText:contains("BLINKDEAL")');
    const found = blinkDealElement.length > 0;

    if (found) {
      // Find the discount percentage
      const discountText = $('.pdp-offers-labelMarkup:contains("Coupon Discount:")').text();
      const discountMatch = discountText.match(/(\d+)%\s+off/);
      const discountPercentage = discountMatch ? Number(discountMatch[1]) : 'unknown';
      
      // Find the total savings
      const savingsMatch = discountText.match(/saving: Rs\. (\d+)/);
      const savings = savingsMatch ? savingsMatch[1] : 'unknown';

      const message = `🟢 Found BLINKDEAL!\nDiscount: ${discountPercentage}%`;
      if (discountPercentage !== previousDiscount) {
        previousDiscount = discountPercentage;
        // await sendNotification(message);
        const messageToBeSent = await waitAndInitiateScrape(page, discountPercentage);
        await sendNotification(message + messageToBeSent);
        console.log("✅ Notification sent:", message);
      }
    } else {
      console.log("❌ BLINKDEAL not found on the page.");
      if (previousDiscount > 0) {
        previousDiscount = 0;
        sendNotification("❌ BLINKDEAL gone!!");
      }
    }
  } catch (error) {
    console.error(`🚨 Error:`, error.message);
    const errorMessage = `Error while checking BLINKDEAL: ${error.message}`;
    await sendNotification(errorMessage);
  } finally {
    // Clean up resources
    try {
      if (page) {
        await page.close();
        page = null;
      }
      if (browser) {
        await browser.close();
        browser = null;
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError.message);
    }
  }
}

export async function runWithInterval() {
  const WAIT_TIME = 10 * 60 * 1000; // 1 minutes in milliseconds
  
  while (true) {
    try {
      console.log('\n🕒 Starting new check cycle...');
      await checkMyntraDiscount();
      
      console.log(`\n⏰ Waiting ${WAIT_TIME/1000/60} minutes before next check...`);
      await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
    } catch (error) {
      console.error('Error in check cycle:', error);
      // Wait 5 minutes before retrying if there's an error
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

