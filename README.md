# 🇨🇳 China Wholesale Scraper Toolkit

[![Apify Store](https://img.shields.io/badge/Apify_Store-3_Tools-blue?logo=apify)](https://apify.com/jungle_intertwining)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)

A complete toolkit for extracting product and supplier data from China's top wholesale platforms. Three pre-built Apify Actors covering the entire B2B sourcing ecosystem — from small commodities to industrial manufacturing.

## 🛠️ Tools Overview

| Platform | Apify Actor | Best For | Users | Runs |
|----------|-------------|----------|-------|------|
| [Yiwugo.com](https://apify.com/jungle_intertwining/yiwugo-scraper) | `jungle_intertwining/yiwugo-scraper` | Small commodities, Yiwu market data | 2 | 9 |
| [DHgate.com](https://apify.com/jungle_intertwining/dhgate-scraper) | `jungle_intertwining/dhgate-scraper` | Dropshipping, small orders, buyer reviews | 2 | 211 |
| [Made-in-China.com](https://apify.com/jungle_intertwining/made-in-china-scraper) | `jungle_intertwining/made-in-china-scraper` | B2B industrial products, verified manufacturers | — | — |

## 🚀 Quick Start

### Option 1: Apify CLI (Recommended)

```bash
npm install -g apify-cli

# Yiwugo — China's largest offline wholesale market
apify call jungle_intertwining/yiwugo-scraper \
  -i '{"searchKeywords": ["bluetooth speaker"], "maxPages": 3}'

# DHgate — Cross-border e-commerce & dropshipping
apify call jungle_intertwining/dhgate-scraper \
  -i '{"searchKeywords": ["wireless earbuds"], "maxPages": 5, "shipTo": "us"}'

# Made-in-China — B2B industrial sourcing
apify call jungle_intertwining/made-in-china-scraper \
  -i '{"searchKeywords": ["CNC machine", "solar panel"], "maxPages": 3}'
```

### Option 2: Apify API

```javascript
const { ApifyClient } = require('apify-client');
const client = new ApifyClient({ token: 'YOUR_APIFY_TOKEN' });

// Run any scraper programmatically
const run = await client.actor('jungle_intertwining/yiwugo-scraper').call({
  searchKeywords: ['LED lights', 'phone case'],
  maxPages: 5,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(`Got ${items.length} products`);
```

### Option 3: Run Locally (Example Code)

Each platform has a standalone example repository:

- [yiwugo-scraper-example](https://github.com/wfgsss/yiwugo-scraper-example) — Node.js example with Cheerio
- [dhgate-scraper-example](https://github.com/wfgsss/dhgate-scraper-example) — Node.js example with `__INITIAL_STATE__` parsing
- [made-in-china-scraper-example](https://github.com/wfgsss/made-in-china-scraper-example) — Node.js CheerioCrawler example

## 📊 Platform Comparison

| Feature | Yiwugo | DHgate | Made-in-China |
|---------|--------|--------|---------------|
| **Product Focus** | Small commodities | Consumer electronics, fashion | Industrial, machinery, B2B |
| **Typical MOQ** | 10-100 pcs | 1-10 pcs | 50-1000+ pcs |
| **Buyer Type** | Small wholesalers | Dropshippers, small retailers | Import companies, procurement agents |
| **Data Access** | SSR (Cheerio) | SSR + `__INITIAL_STATE__` JSON | SSR (Cheerio) |
| **Anti-Scraping** | Moderate | Low | FCaptcha on detail pages |
| **Price Transparency** | High (CNY) | High (USD, tiered) | Medium (USD, range) |
| **Supplier Verification** | Basic | Feedback % | Audited Supplier badges |
| **Unique Data** | Yiwu market stall numbers | Shipping options, buyer reviews | Business type, factory audits |

## 🔍 Use Cases

### Price Comparison Across Platforms

```javascript
// Find the cheapest bluetooth speakers across all three platforms
const yiwugo = await scrapeYiwugo('bluetooth speaker');
const dhgate = await scrapeDHgate('bluetooth speaker');
const mic = await scrapeMadeInChina('bluetooth speaker');

const allProducts = [
  ...yiwugo.map(p => ({ ...p, platform: 'Yiwugo' })),
  ...dhgate.map(p => ({ ...p, platform: 'DHgate' })),
  ...mic.map(p => ({ ...p, platform: 'Made-in-China' })),
];

// Sort by price, filter verified suppliers
const deals = allProducts
  .filter(p => p.price && p.supplierName)
  .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
```

### Supplier Discovery Pipeline

```
1. Search Made-in-China.com → Find audited manufacturers
2. Cross-reference → Check Yiwu market availability
3. Verify on DHgate → Read buyer reviews and feedback scores
4. Export to CRM → Contact shortlisted suppliers
```

### Market Research Dashboard

```
1. Track product prices weekly across all platforms
2. Identify trending categories (rising search volume)
3. Compare supplier density by region (Guangdong vs Zhejiang vs Fujian)
4. Monitor new supplier entries and exits
```

## 📦 Output Schema

All three scrapers output structured JSON. Common fields:

```json
{
  "productName": "Wireless Bluetooth Speaker 20W",
  "price": "US$12.50-18.00",
  "moq": "2 Pieces",
  "supplierName": "Shenzhen Audio Tech Co., Ltd",
  "supplierLocation": "Guangdong, China",
  "imageUrl": "https://...",
  "productUrl": "https://...",
  "searchKeyword": "bluetooth speaker",
  "scrapedAt": "2026-02-15T12:00:00.000Z"
}
```

Platform-specific fields:

| Field | Yiwugo | DHgate | Made-in-China |
|-------|--------|--------|---------------|
| `stallNumber` | ✅ | — | — |
| `freeShipping` | — | ✅ | — |
| `feedbackPercent` | — | ✅ | — |
| `totalSold` | — | ✅ | — |
| `businessType` | — | — | ✅ |
| `auditedSupplier` | — | — | ✅ |
| `memberLevel` | — | — | ✅ |

## 📚 Tutorials & Articles

### Getting Started
- [Scraping Chinese E-commerce Sites: Challenges and Solutions](https://dev.to/wfgsss/scraping-chinese-e-commerce-sites-challenges-and-solutions-51bj)
- [Best China Wholesale Data Scrapers (2026)](https://dev.to/wfgsss/best-china-wholesale-data-scrapers-2026-a-practical-comparison-1i77)

### Yiwugo
- [How to Scrape Yiwugo.com for Wholesale Product Data](https://dev.to/wfgsss/how-to-scrape-yiwugocom-for-wholesale-product-data-4hn)
- [How to Extract Product Images from Yiwugo.com](https://dev.to/wfgsss/how-to-extract-product-images-from-yiwugocom-for-your-e-commerce-store-5ach)
- [How to Monitor Yiwugo Product Prices Automatically](https://dev.to/wfgsss/how-to-monitor-yiwugo-product-prices-automatically-4gch)
- [Automating Supplier Discovery: A Python Script for Yiwugo.com](https://dev.to/wfgsss/automating-supplier-discovery-a-python-script-for-yiwugocom-4pej)

### DHgate
- [How to Scrape DHgate.com for Wholesale Product Data](https://dev.to/wfgsss/how-to-scrape-dhgatecom-for-wholesale-product-data-gk)
- [How to Find Dropshipping Products on DHgate Using Data](https://dev.to/wfgsss/how-to-find-dropshipping-products-on-dhgate-using-data-4fp)
- [DHgate vs AliExpress: Which Platform Has Better Wholesale Data?](https://dev.to/wfgsss/dhgate-vs-aliexpress-which-platform-has-better-wholesale-data-for-dropshippers-3end)

### Made-in-China
- [How to Scrape Made-in-China.com for B2B Product Data](https://dev.to/wfgsss/how-to-scrape-made-in-chinacom-for-b2b-product-data-pfb)
- [How to Find Verified Manufacturers on Made-in-China.com](https://dev.to/wfgsss/how-to-find-verified-manufacturers-on-made-in-chinacom-using-data-5657)

### Cross-Platform
- [Made-in-China vs DHgate vs Yiwugo: Which Platform to Scrape](https://dev.to/wfgsss/made-in-chinacom-vs-dhgate-vs-yiwugo-which-platform-to-scrape-for-wholesale-product-data-42d9)
- [How to Build a China Wholesale Price Tracker](https://dev.to/wfgsss/how-to-build-a-china-wholesale-price-tracker-with-dhgate-and-yiwugo-data-1dea)
- [How to Use Yiwugo Data to Find Trending Products](https://dev.to/wfgsss/how-to-use-yiwugo-data-to-find-trending-products-before-they-go-viral-78h)

## 💡 Examples

All example scripts live in [`examples/`](examples/). Install dependencies first:

```bash
cd examples && npm install
```

### Cross-Platform Price Comparison (Node.js)

The [`cross-platform-price-comparison.js`](examples/cross-platform-price-comparison.js) script runs all three scrapers for the same keyword, merges results, and prints a sorted comparison table with per-platform stats. Exports results to JSON.

```bash
APIFY_TOKEN=your_token node examples/cross-platform-price-comparison.js "bluetooth speaker"
```

### Cross-Platform Price Comparison (Python)

Same functionality in Python with CSV + JSON export:

```bash
pip install apify-client
APIFY_TOKEN=your_token python3 examples/cross-platform-price-comparison.py "bluetooth speaker"
```

### Export to CSV

The [`export-comparison-csv.js`](examples/export-comparison-csv.js) script runs all three scrapers and exports a clean CSV with normalized USD prices — ready for Excel/Google Sheets analysis.

```bash
APIFY_TOKEN=your_token node examples/export-comparison-csv.js "wireless earbuds"
# → comparison-wireless-earbuds.csv
```

### Supplier Ranking

The [`supplier-ranking.js`](examples/supplier-ranking.js) script ranks suppliers by a composite score based on price competitiveness (0-40 pts), product variety (0-30 pts), and trust signals (0-30 pts). Helps identify the best suppliers across all three platforms.

```bash
APIFY_TOKEN=your_token node examples/supplier-ranking.js "bluetooth speaker"
# → supplier-ranking-bluetooth-speaker.json
```

### Sample Output

```
📊 Price Comparison: "bluetooth speaker" (87 products)

Platform       | Product                                  | Price              | MOQ          | Supplier
---------------+------------------------------------------+--------------------+--------------+----------------------------
Yiwugo         | Mini Portable Bluetooth Speaker 10W       | ¥18.50             | 100 Pieces   | Yiwu Soundwave Electronics
DHgate         | Wireless Bluetooth Speaker Waterproof     | US$8.99-12.50      | 1 Piece      | Shenzhen Audio Store
Made-in-China  | 20W Bluetooth Speaker OEM Factory         | US$6.80-9.50       | 500 Pieces   | Dongguan Smart Audio Co.

📈 Summary by Platform:

  Yiwugo: 30 products | Price range: $2.59 – $18.90 | Avg: $7.42
  DHgate: 32 products | Price range: $3.99 – $45.00 | Avg: $14.28
  Made-in-China: 25 products | Price range: $1.20 – $22.00 | Avg: $8.15
```

## 🤝 Contributing

Found a bug or have a feature request? Open an issue in the relevant repository:

- [yiwugo-scraper-example](https://github.com/wfgsss/yiwugo-scraper-example/issues)
- [dhgate-scraper-example](https://github.com/wfgsss/dhgate-scraper-example/issues)
- [made-in-china-scraper-example](https://github.com/wfgsss/made-in-china-scraper-example/issues)

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

Built with [Apify](https://apify.com) and [Crawlee](https://crawlee.dev).
