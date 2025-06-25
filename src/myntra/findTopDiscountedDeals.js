const GoldPricePerGram22 = 9090;
const GoldPricePerGram24 = 9924;
let pageCount = 0;
const showTop = 5;

function getGoldPrice(karat) {
    if (karat === 22) {
        return GoldPricePerGram22;
    } else if (karat === 24) {
        return GoldPricePerGram24;
    }
}

async function scrapeValues(page, coupon_discount = 0) {
    const results = await page.evaluate((discount) => {
        const items = {
            "22K": [],
            "24K": []
        };
        
        document.querySelectorAll(".results-base .product-base").forEach((item) => {
            const href = item.querySelector("a").href;
            const prod = item.querySelector(".product-product").innerText;
            const is24K = prod.indexOf("24K") !== -1;
            const is22K = prod.indexOf("22K") !== -1;
            let qty = parseFloat(prod.split("-")[1]);
            if (isNaN(qty)) {
                qty = parseFloat(prod.split("oin").filter((v) => parseInt(v)!==24 && parseInt(v)!==22 && !isNaN(parseInt(v)))[0])
            }
            const price = parseInt(item.querySelector(".product-price").innerText.split("Rs. ")[1]);
            
            let additionalCostPercentage;
            if (is24K) {
                additionalCostPercentage = (price/(qty*9924)-1)*100
            } else if (is22K) {
                additionalCostPercentage = (price/(qty*9090)-1)*100
            }
            
            if (additionalCostPercentage) {
                const itemData = {
                    additionalCostPercentage: additionalCostPercentage - discount,
                    href,
                    qty,
                    price,
                    is22K,
                    name: prod
                };
                
                if (is22K) {
                    items["22K"].push(itemData);
                } else {
                    items["24K"].push(itemData);
                }
            }
        });
        return items;
    }, coupon_discount);
    
    return results;
}

function createMessageToBeSent(sortedResults) {
    const messageToBeSent = `\n\n🏆 Top ${showTop} Discounted Items:\n\n` +
        `<b>22K Gold Items:</b>\n\n` +
        sortedResults["22K"].slice(0, showTop).map((item, index) => 
            `${index + 1}. <b>${item.name}</b>\n` +
            `   Rs. ${item.price}\n` +
            `   Extra: ${item.additionalCostPercentage.toFixed(2)}%\n` +
            `   <a href="${item.href}">🔗 View Product</a>`
        ).join('\n\n') +
        `\n\n<b>24K Gold Items:</b>\n\n` +
        sortedResults["24K"].slice(0, showTop).map((item, index) => 
            `${index + 1}. <b>${item.name}</b>\n` +
            `   Rs. ${item.price}\n` +
            `   Extra: ${item.additionalCostPercentage.toFixed(2)}%\n` +
            `   <a href="${item.href}">🔗 View Product</a>`
        ).join('\n\n');
    console.log("messageToBeSent", messageToBeSent);
    return messageToBeSent;
}

async function waitAndInitiateScrape(page, discountPercentage = 0) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto(process.env.URL, { 
                waitUntil: 'networkidle2',
                timeout: 30000 // 30 seconds timeout
            });

            let allResults = {
                "22K": [],
                "24K": []
            };

            const processPage = async () => {
                const pageResults = await scrapeValues(page, discountPercentage);
                
                // Merge results
                allResults["22K"] = [...allResults["22K"], ...pageResults["22K"]];
                allResults["24K"] = [...allResults["24K"], ...pageResults["24K"]];
                
                console.log("scraping done for Page: ", ++pageCount);
                
                const hasNextPage = await page.evaluate(() => {
                    return document.querySelectorAll(".pagination-next").length > 0;
                });

                if (hasNextPage) {
                    await page.click(".pagination-next");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await processPage();
                } else {
                    // Sort results
                    allResults["22K"].sort((a,b) => a.additionalCostPercentage - b.additionalCostPercentage);
                    allResults["24K"].sort((a,b) => a.additionalCostPercentage - b.additionalCostPercentage);
                    
                    console.log("Final results:", allResults["22K"].slice(0, showTop), allResults["24K"].slice(0, showTop));
                    resolve(createMessageToBeSent(allResults));
                }
            };

            await processPage();
        } catch (error) {
            reject(error);
        }
    });
}

export { waitAndInitiateScrape };