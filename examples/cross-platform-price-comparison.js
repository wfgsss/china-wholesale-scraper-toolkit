/**
 * Cross-Platform Price Comparison
 *
 * Runs all three China wholesale scrapers (Yiwugo, DHgate, Made-in-China)
 * for the same keyword, merges results, and outputs a comparison table.
 *
 * Usage:
 *   APIFY_TOKEN=your_token node examples/cross-platform-price-comparison.js "bluetooth speaker"
 *
 * Requirements:
 *   npm install apify-client
 */

const { ApifyClient } = require('apify-client');

const ACTORS = {
  yiwugo: {
    id: 'jungle_intertwining/yiwugo-scraper',
    name: 'Yiwugo',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2 }),
  },
  dhgate: {
    id: 'jungle_intertwining/dhgate-scraper',
    name: 'DHgate',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2, shipTo: 'us' }),
  },
  mic: {
    id: 'jungle_intertwining/made-in-china-scraper',
    name: 'Made-in-China',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 2 }),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the lowest numeric USD price from a price string. */
function parseMinPrice(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/,/g, '');
  // "US$12.50-18.00" → 12.50 | "¥8.5" → 8.5 (CNY, ~1.2 USD rough)
  const usd = s.match(/\$\s*([\d.]+)/);
  if (usd) return parseFloat(usd[1]);
  const cny = s.match(/([\d.]+)/);
  if (cny) return parseFloat(cny[1]) * 0.14; // rough CNY→USD
  return null;
}

/** Truncate a string to `len` chars. */
function trunc(s, len = 40) {
  if (!s) return '—';
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

/** Pad/align for console table. */
function pad(s, w) {
  s = String(s);
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('Usage: node cross-platform-price-comparison.js "<keyword>"');
    process.exit(1);
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('Set APIFY_TOKEN environment variable first.');
    process.exit(1);
  }

  const client = new ApifyClient({ token });
  console.log(`\n🔍 Searching "${keyword}" across 3 platforms...\n`);

  // Run all three scrapers in parallel
  const runs = await Promise.allSettled(
    Object.entries(ACTORS).map(async ([key, actor]) => {
      console.log(`  ⏳ Starting ${actor.name}...`);
      const run = await client.actor(actor.id).call(actor.input(keyword), {
        waitSecs: 120,
      });
      const { items } = await client
        .dataset(run.defaultDatasetId)
        .listItems({ limit: 50 });
      console.log(`  ✅ ${actor.name}: ${items.length} products`);
      return { platform: actor.name, items };
    })
  );

  // Merge results
  const merged = [];
  for (const r of runs) {
    if (r.status !== 'fulfilled') continue;
    const { platform, items } = r.value;
    for (const item of items) {
      merged.push({
        platform,
        name: item.productName || item.title || '',
        price: item.price || '',
        minPrice: parseMinPrice(item.price),
        moq: item.moq || item.minOrder || '—',
        supplier: item.supplierName || item.seller || '—',
        url: item.productUrl || item.url || '',
      });
    }
  }

  if (merged.length === 0) {
    console.log('\nNo results found across any platform.');
    return;
  }

  // Sort by price (cheapest first), nulls last
  merged.sort((a, b) => {
    if (a.minPrice == null && b.minPrice == null) return 0;
    if (a.minPrice == null) return 1;
    if (b.minPrice == null) return -1;
    return a.minPrice - b.minPrice;
  });

  // Print comparison table
  const cols = { platform: 15, name: 42, price: 20, moq: 14, supplier: 28 };
  const sep =
    '-'.repeat(cols.platform) + '+-' +
    '-'.repeat(cols.name) + '+-' +
    '-'.repeat(cols.price) + '+-' +
    '-'.repeat(cols.moq) + '+-' +
    '-'.repeat(cols.supplier);

  console.log(`\n📊 Price Comparison: "${keyword}" (${merged.length} products)\n`);
  console.log(
    pad('Platform', cols.platform) + '| ' +
    pad('Product', cols.name) + '| ' +
    pad('Price', cols.price) + '| ' +
    pad('MOQ', cols.moq) + '| ' +
    pad('Supplier', cols.supplier)
  );
  console.log(sep);

  for (const p of merged.slice(0, 30)) {
    console.log(
      pad(p.platform, cols.platform) + '| ' +
      pad(trunc(p.name, cols.name - 1), cols.name) + '| ' +
      pad(trunc(p.price, cols.price - 1), cols.price) + '| ' +
      pad(trunc(String(p.moq), cols.moq - 1), cols.moq) + '| ' +
      pad(trunc(p.supplier, cols.supplier - 1), cols.supplier)
    );
  }

  if (merged.length > 30) {
    console.log(`  ... and ${merged.length - 30} more products`);
  }

  // Summary stats per platform
  console.log('\n📈 Summary by Platform:\n');
  for (const plat of ['Yiwugo', 'DHgate', 'Made-in-China']) {
    const items = merged.filter((p) => p.platform === plat);
    const prices = items.map((p) => p.minPrice).filter(Boolean);
    if (items.length === 0) {
      console.log(`  ${plat}: no results`);
      continue;
    }
    const avg = prices.length
      ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
      : '—';
    const min = prices.length ? Math.min(...prices).toFixed(2) : '—';
    const max = prices.length ? Math.max(...prices).toFixed(2) : '—';
    console.log(
      `  ${plat}: ${items.length} products | Price range: $${min} – $${max} | Avg: $${avg}`
    );
  }

  // Export to JSON
  const outFile = `comparison-${keyword.replace(/\s+/g, '-')}.json`;
  require('fs').writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`\n💾 Full results saved to ${outFile}\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
