# Store recommendation constraints

The pipeline uses Serper snippets, Qwen classification and deterministic ranking. It does not train a recommendation model or measure current branch inventory.

## Search and evidence

- Search the saved supplier and branch first. Retry the chain search when there is no matching product price associated with that supplier, including when the first search only finds another retailer.
- Retain at most 30 distinct HTTP/HTTPS source pages. Remove tracking parameters for deduplication while preserving product query parameters and original citation URLs.
- Require product words and explicitly requested quantities before classification. Equivalent mass or volume units match; different sizes and explicitly different multipacks do not. This conservative check can miss synonyms or incomplete snippets.
- General market estimates remain unconfirmed supplier prices. An online stock statement does not verify branch inventory.
- Search the general market once per material and persist a shared reference with median, observed range, distinct listing count, sources and fetch time. Keep this reference separate from individual store prices.

## Qwen and ranking

- Treat web snippets and record text as untrusted data. Validate classification indices, completeness, boolean types and store labels in code.
- Qwen cannot bypass the product/quantity check or replace extracted prices.
- Use JSON object mode for ranking and validate candidate IDs, unique ranks, reason lengths and Top 1 eligibility in code. Invalid provider output falls back to deterministic ranking.
- Exclude out-of-stock candidates before calculating normalization ranges. Use confirmed prices to determine the price range; unknown and estimated quotes receive the worst price component.
- Send at most 30 eligible candidates to Qwen. Preserve the default distance/price weights of 60%/40% and straight-line distances.
- Top 1 requires a confirmed store/chain quote and valid coordinates. Stock remains unconfirmed even for Top 1.
- Recommendation confidence is evidence quality, not a calibrated probability or Qwen self-rating. Moderate requires a confirmed store quote, valid coordinates and evidence fetched within 24 hours. Otherwise it is Low. Branch stock remains unconfirmed, so this pipeline does not award High confidence.
- The UI displays a percentage evidence score: confirmed price 40 points, freshness 20, valid location 15, multiple distinct pricing sources 10. The remaining 15 requires verified branch stock. Unconfirmed prices are capped at 40; old or undated evidence is capped at 45; out-of-stock recommendations score zero. Saved results without a percentage require a new search.

Run regression checks with:

```powershell
python -m unittest discover -s 'AI-Store Reco' -p 'test_*.py'
```

The automated checks mock provider requests. They do not establish live search recall, current prices, or Qwen accuracy.
