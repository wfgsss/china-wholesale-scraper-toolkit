#!/usr/bin/env node
/**
 * Export Cross-Platform Comparison to CSV
 *
 * Runs all three scrapers and exports a clean CSV file for spreadsheet analysis.
 * Includes normalized USD prices for easy sorting/filtering.
 *
 * Usage:
 *   APIFY_TOKEN=your_token node export-comparison-csv.js "bluetooth speaker"
 *
 * Output:
 *   comparison-bluetooth-speaker.csv
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs');

const ACTORS = {
  yiwugo: {
    id: 'jungle_intertwining/yiwugo-scraper',
    name: 'Yiwugo',
    currency: 'CNY',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2 }),
  },
  dhgate: {
    id: 'jungle_intertwining/dhgate-scraper',
    name: 'DHgate',
    currency: 'USD',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2, shipTo: 'us' }),
  },
  mic: {
    id: 'jungle_intertwining/made-in-china-scraper',
    name: 'Made-in-China',
    currency: 'USD',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2 }),
  },
};

const CNY_TO_USD = 0.14;

function parseMinPrice(raw, currency) {
  if (!raw) return '';
  const s = String(raw).replace(/,/g, '');
  const m = s.match(/([\d.]+)/);
  if (!m) return '';
  const val = parseFloat(m[1]);
  return currency === 'CNY' ? (val * CNY_TO_USD).toFixed(2) : val.toFixed(2);
}

function escapeCSV(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('Usage: node export-comparison-csv.js "<keyword>"');
    process.exit(1);
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('Set APIFY_TOKEN environment variable first.');
    process.exit(1);
  }

  const client = new ApifyClient({ token });
  console.log(`\n🔍 Searching "${keyword}" across 3 platforms...\n`);

  const rows = [];

  for (const [key, actor] of Object.entries(ACTORS)) {
    try {
      console.log(`  ⏳ ${actor.name}...`);
      const run = await client.actor(actor.id).call(actor.input(keyword), {
        waitSecs: 120,
      });
      const { items } = await client
        .dataset(run.defaultDatasetId)
        .listItems({ limit: 100 });
      console.log(`  ✅ ${actor.name}: ${items.length} products`);

      for (const item of items) {
        const priceRaw = item.price || '';
        rows.push({
          platform: actor.name,
          product: item.productName || item.title || '',
          priceOriginal: priceRaw,
          priceUSD: parseMinPrice(priceRaw, actor.currency),
          moq: item.moq || item.minOrder || '',
          supplier: item.supplierName || item.seller || '',
          location: item.supplierLocation || item.location || '',
          url: item.productUrl || item.url || '',
        });
      }
    } catch (err) {
      console.error(`  ❌ ${actor.name}: ${err.message}`);
    }
  }

  if (rows.length === 0) {
    console.log('\nNo results. Exiting.');
    return;
  }

  // Sort by USD price
  rows.sort((a, b) => {
    const pa = a.priceUSD ? parseFloat(a.priceUSD) : Infinity;
    const pb = b.priceUSD ? parseFloat(b.priceUSD) : Infinity;
    return pa - pb;
  });

  // Write CSV
  const headers = [
    'Platform',
    'Product',
    'Price (Original)',
    'Price (USD)',
    'MOQ',
    'Supplier',
    'Location',
    'URL',
  ];
  const csvLines = [headers.join(',')];
  for (const r of rows) {
    csvLines.push(
      [
        escapeCSV(r.platform),
        escapeCSV(r.product),
        escapeCSV(r.priceOriginal),
        escapeCSV(r.priceUSD),
        escapeCSV(r.moq),
        escapeCSV(r.supplier),
        escapeCSV(r.location),
        escapeCSV(r.url),
      ].join(',')
    );
  }

  const outFile = `comparison-${keyword.replace(/\s+/g, '-')}.csv`;
  fs.writeFileSync(outFile, csvLines.join('\n'), 'utf-8');
  console.log(`\n📄 CSV exported: ${outFile} (${rows.length} rows)\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
