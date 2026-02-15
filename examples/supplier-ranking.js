#!/usr/bin/env node
/**
 * Cross-Platform Supplier Ranking
 *
 * Runs all three scrapers, then ranks suppliers by a composite score
 * based on price competitiveness, product variety, and verification status.
 * Outputs a ranked supplier list + JSON export.
 *
 * Usage:
 *   APIFY_TOKEN=your_token node examples/supplier-ranking.js "bluetooth speaker"
 *
 * Requirements:
 *   npm install apify-client
 */

const { ApifyClient } = require('apify-client');
const fs = require('fs');

const ACTORS = {
  yiwugo: {
    id: 'jungle_intertwining/yiwugo-scraper',
    name: 'Yiwugo',
    currency: 'CNY',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 3 }),
  },
  dhgate: {
    id: 'jungle_intertwining/dhgate-scraper',
    name: 'DHgate',
    currency: 'USD',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 3, shipTo: 'us' }),
  },
  mic: {
    id: 'jungle_intertwining/made-in-china-scraper',
    name: 'Made-in-China',
    currency: 'USD',
    input: (kw) => ({ searchKeywords: [kw], maxPages: 3 }),
  },
};

const CNY_TO_USD = 0.14;

function parseMinPrice(raw, currency) {
  if (!raw) return null;
  const s = String(raw).replace(/,/g, '');
  const usd = s.match(/\$\s*([\d.]+)/);
  if (usd) return parseFloat(usd[1]);
  const num = s.match(/([\d.]+)/);
  if (!num) return null;
  const val = parseFloat(num[1]);
  return currency === 'CNY' ? val * CNY_TO_USD : val;
}

function trunc(s, len = 30) {
  if (!s) return '—';
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('Usage: node supplier-ranking.js "<keyword>"');
    process.exit(1);
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('Set APIFY_TOKEN environment variable first.');
    process.exit(1);
  }

  const client = new ApifyClient({ token });
  console.log(`\n🔍 Searching "${keyword}" across 3 platforms...\n`);

  // Collect all products
  const allProducts = [];

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
        allProducts.push({
          platform: actor.name,
          product: item.productName || item.title || '',
          price: item.price || '',
          priceUSD: parseMinPrice(item.price, actor.currency),
          supplier: item.supplierName || item.seller || '',
          location: item.supplierLocation || item.location || '',
          verified: !!(item.auditedSupplier || item.memberLevel),
          feedback: item.feedbackPercent || null,
          url: item.productUrl || item.url || '',
        });
      }
    } catch (err) {
      console.error(`  ❌ ${actor.name}: ${err.message}`);
    }
  }

  if (allProducts.length === 0) {
    console.log('\nNo results found.');
    return;
  }

  // Group by supplier
  const supplierMap = new Map();
  for (const p of allProducts) {
    const mapKey = `${p.supplier}||${p.platform}`;
    if (!supplierMap.has(mapKey)) {
      supplierMap.set(mapKey, {
        supplier: p.supplier,
        platform: p.platform,
        location: p.location,
        verified: p.verified,
        feedback: p.feedback,
        products: [],
        prices: [],
      });
    }
    const entry = supplierMap.get(mapKey);
    entry.products.push(p.product);
    if (p.priceUSD != null) entry.prices.push(p.priceUSD);
    if (p.verified) entry.verified = true;
  }

  // Score each supplier
  const allPrices = allProducts.map((p) => p.priceUSD).filter(Boolean);
  const sortedPrices = [...allPrices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 10;

  const ranked = [];
  for (const [, s] of supplierMap) {
    if (!s.supplier || s.supplier === '—') continue;

    // Price score: lower avg price = higher score (0-40 pts)
    const avgPrice = s.prices.length
      ? s.prices.reduce((a, b) => a + b, 0) / s.prices.length
      : null;
    const priceScore = avgPrice != null
      ? Math.max(0, Math.min(40, 40 * (1 - avgPrice / (medianPrice * 2))))
      : 0;

    // Variety score: more products = higher score (0-30 pts)
    const varietyScore = Math.min(30, s.products.length * 6);

    // Trust score: verified + feedback (0-30 pts)
    let trustScore = 0;
    if (s.verified) trustScore += 15;
    if (s.feedback) {
      const fb = parseFloat(String(s.feedback).replace('%', ''));
      if (fb > 0) trustScth.min(15, (fb / 100) * 15);
    }
    if (s.location && s.location !== '—') trustScore += 5;
    trustScore = Math.min(30, trustScore);

    const totalScore = Math.round(priceScore + varietyScore + trustScore);

    ranked.push({
      supplier: s.supplier,
      platform: s.platform,
      location: s.location || '—',
      productCount: s.products.length,
      avgPrice: avgPrice != null ? `$${avgPrice.toFixed(2)}` : '—',
      verified: s.verified ? '✓' : '',
      score: totalScore,
      breakdown: {
        price: Math.round(priceScore),
        variety: Math.round(varietyScore),
        trust: Math.round(trustScore),
      },
    });
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  // Print ranking table
  console.log(`\n🏆 Supplier Ranking: "${keyword}" (${ranked.length} suppliers)\n`);
  console.log('  Score = Price (0-40) + Variety (0-30) + Trust (0-30)\n');

  const cols = { rank: 5, supplier: 30, platform: 15, products: 9, avgPrice: 12, verified: 5, score: 7 };
  console.log(
    pad('#', cols.rank) +
    pad('Supplier', cols.supplier) +
    pad('Platform', cols.platform) +
    pad('Products', cols.products) +
    pad('Avg Price', cols.avgPrice) +
    pad('Vrf', cols.verified) +
    pad('Score', cols.score) +
    'Breakdown'
  );
  console.log('-'.repeat(105));

  const top = ranked.slice(0, 25);
  for (let i = 0; i < top.length; i++) {
    const s = top[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    console.log(
      pad(medal, cols.rank) +
      pad(trunc(s.supplier, cols.supplier - 1), cols.supplier) +
      pad(s.platform, cols.platform) +
      pad(String(s.productCount), cols.products) +
      pad(s.avgPrice, cols.avgPrice) +
      pad(s.verified, cols.verified) +
      pad(String(s.score), cols.score) +
 :${s.breakdown.price} V:${s.breakdown.variety} T:${s.breakdown.trust}`
    );
  }

  if (ranked.length > 25) {
    console.log(`\n  ... and ${ranked.length - 25} more suppliers`);
  }

  // Export
  const outFile = `supplier-ranking-${keyword.replace(/\s+/g, '-')}.json`;
  fs.writeFileSync(outFile, JSON.stringify(ranked, null, 2));
  console.log(`\n💾 Full ranking saved to ${outFile}\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
