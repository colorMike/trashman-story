# Changelog

## 2.0.0 – 2026-10-08

Complete rewrite of the 2015 FH Salzburg prototype.

* Manifest V3, works in Chrome, Edge, Brave and Firefox (121+).
* No jQuery, no build step, plain ES modules.
* Pages are found by generic link harvesting instead of scraping Google's
  `#main` element, so layout changes no longer break the plugin.
* Seven start sites instead of one: Google, Bing, DuckDuckGo, Amazon, eBay,
  idealo and Wikipedia. Shops are the best retargeting bait.
* Human-like pacing: log-uniform jitter between 25 s and 2 min, a few pages
  per site, then a new search; 15 % chance to start a fresh search anyway.
* Pauses while the user is idle, daily limit, mute instead of ripping out
  media, links to logout/cart/checkout/download are never followed.
* Avatar picker with all 51 outfits grouped by category, sprite idle animation
  kept from the original.
* Stats: per day, per outfit, per start site, last pages, plus links to the
  Google / Facebook / Amazon ad-profile pages to verify the effect.
* Keyword lists cleaned (encoding, typos, duplicates) and extended to 726.
* Unit tests for the engine, GitHub Actions for test and release zips.

## 1.0.1 – 2015

Original Chrome plugin by David Neubauer and Joscha Probst.
