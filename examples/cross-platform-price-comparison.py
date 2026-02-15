#!/usr/bin/env python3
"""
Cross-Platform Price Comparison (Python version)

Runs all three China wholesale scrapers (Yiwugo, DHgate, Made-in-China)
for the same keyword, merges results, and outputs a comparison table + CSV.

Usage:
    APIFY_TOKEN=your_token python3 cross-platform-price-comparison.py "bluetooth speaker"

Requirements:
    pip install apify-client
"""

import asyncio
import csv
import json
import os
import re
import sys
from apify_client import ApifyClient

ACTORS = {
    "yiwugo": {
        "id": "jungle_intertwining/yiwugo-scraper",
        "name": "Yiwugo",
        "input": lambda kw: {"searchKeywords": [kw], "maxPages": 2},
    },
    "dhgate": {
        "id": "jungle_intertwining/dhgate-scraper",
        "name": "DHgate",
        "input": lambda kw: {"searchKeywords": [kw], "maxPages": 2, "shipTo": "us"},
    },
    "mic": {
        "id": "jungle_intertwining/made-in-china-scraper",
        "name": "Made-in-China",
        "input": lambda kw: {"searchKeywords": [kw], "maxPages": 2},
    },
}

CNY_TO_USD = 0.14  # rough conversion


def parse_min_price(raw: str | None) -> float | None:
    """Extract the lowest numeric USD price from a price string."""
    if not raw:
        return None
    s = str(raw).replace(",", "")
    m = re.search(r"\$\s*([\d.]+)", s)
    if m:
        return float(m.group(1))
    m = re.search(r"([\d.]+)", s)
    if m:
        return float(m.group(1)) * CNY_TO_USD
    return None


def run_scraper(client: ApifyClient, key: str, keyword: str) -> list[dict]:
    """Run a single scraper and return normalized results."""
    actor = ACTORS[key]
    print(f"  ⏳ Starting {actor['name']}...")
    run = client.actor(actor["id"]).call(
        run_input=actor["input"](keyword),
        timeout_secs=120,
    )
    items = list(
        client.dataset(run["defaultDatasetId"]).iterate_items(limit=50)
    )
    print(f"  ✅ {actor['name']}: {len(items)} products")

    results = []
    for item in items:
        price_raw = item.get("price", "")
        results.append(
            {
                "platform": actor["name"],
                "name": item.get("productName") or item.get("title") or "",
                "price": price_raw,
                "minPrice": parse_min_price(price_raw),
                "moq": item.get("moq") or item.get("minOrder") or "—",
                "supplier": item.get("supplierNa") or item.get("seller") or "—",
                "url": item.get("productUrl") or item.get("url") or "",
            }
        )
    return results


def print_table(keyword: str, merged: list[dict]) -> None:
    """Print a formatted comparison table to stdout."""
    print(f'\n📊 Price Comparison: "{keyword}" ({len(merged)} products)\n')
    header = f"{'Platform':<15}| {'Product':<42}| {'Price':<20}| {'MOQ':<14}| {'Supplier':<28}"
    print(header)
    print("-" * len(header))

    for p in merged[:30]:
        name = (p["name"][:40] + "…") if len(p["name"]) > 41 else p["name"]
        price = (p["price"][:18] + "…") if len(str(p["price"])) > 19 else str(p["price"])
        moq = (str(p["moq"])[:12] + "…") if len(str(p["moq"])) > 13 else str(p["moq"])
        supplier = (p["supplier"][:26] + "…") if len(p["supplier"]) > 27 else p["supplier"]
        print(f"{p['platform']:<15}| {name:<42}| {price:<20}| {moq:<14}| {supplier:<28}")

    if len(merged) > 30:
        print(f"  ... and {len(merged) - 30} more products")

    # Per-platform summary
    print("\n📈 Summary by Platform:\n")
    for plat in ["Yiwugo", "DHgate", "Made-in-China"]:
        items = [p for p in merged if p["platform"] == plat]
        prices = [p["minPrice"] for p in items if p["minPrice"] is not None]
        if not items:
            print(f"  {plat}: no results")
            continue
        avg = f"${sum(prices) / len(prices):.2f}" if prices else "—"
        lo = f"${min(prices):.2f}" if prices else "—"
        hi = f"${max(prices):.2f}" if prices else "—"
        print(f"  {plat}: {len(items)} products | Price range: {lo} – {hi} | Avg: {avg}")


def export_csv(keyword: str, merged: list[dict]) -> str:
    """Export results to CSV and return the filename."""
    filename = f"comparison-{keyword.replace(' ', '-')}.csv"
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["platform", "name", "price", "minPrice", "moq", "supplier", "url"],
        )
        writer.writeheader()
        writer.writerows(merged)
    return filename


def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python3 cross-platform-price-comparison.py "<keyword>"')
        sys.exit(1)

    keyword = sys.argv[1]
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("Set APIFY_TOKEN environment variable first.")
        sys.exit(1)

    client = ApifyClient(token)
    print(f'\n🔍 Searching "{keyword}" across 3 platforms...\n')

    merged: list[dict] = []
    for key in ACTORS:
        try:
            merged.extend(run_scraper(client, key, keyword))
        except Exception as e:
            print(f"  ❌ {ACTORS[key]['name']}: {e}")

    if not merged:
        print("\nNo results found across any platform.")
        return

    # Sort by price (cheapest first), nulls last
    merged.sort(key=lambda p: (p["minPrice"] is None, p["minPrice"] or 0))

    print_table(keyword, merged)

    # Export
    json_file = f"comparison-{keyword.replace(' ', '-')}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"\n💾 JSON saved to {json_file}")

    csv_file = export_csv(keyword, merged)
    print(f"📄 CSV saved to {csv_file}\n")


if __name__ == "__main__":
    main()
