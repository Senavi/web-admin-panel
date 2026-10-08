#!/usr/bin/env bash
# Mobile Lighthouse (production build) for the demo pages: median of 3 runs.
# Usage: scripts/lighthouse.sh http://localhost:3500 / /about
set -euo pipefail
BASE="$1"; shift
OUT="${LH_OUT:-.lighthouse}"; mkdir -p "$OUT"
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
for path in "$@"; do
  name=$(echo "$path" | tr '/' '_')
  for run in 1 2 3; do
    CHROME_PATH="$CHROME" npx -y lighthouse@13.5.0 "$BASE$path" --quiet --chrome-flags="--headless=new" \
      --form-factor=mobile --extra-headers='{"Accept-Language":"en"}' \
      --only-categories=performance,accessibility,best-practices,seo \
      --output=json --output-path="$OUT/lh${name}_${run}.json" >/dev/null 2>&1
  done
  python3 - "$OUT" "$name" "$path" <<'PY'
import json, statistics, sys
out, name, path = sys.argv[1:4]
runs = [json.load(open(f"{out}/lh{name}_{i}.json")) for i in (1, 2, 3)]
perf = sorted(runs, key=lambda r: r["categories"]["performance"]["score"])[1]
scores = {k: round(v["score"] * 100) for k, v in perf["categories"].items()}
a = perf["audits"]
print(path, scores, "LCP", a["largest-contentful-paint"]["displayValue"], "CLS", a["cumulative-layout-shift"]["displayValue"], "TBT", a["total-blocking-time"]["displayValue"])
PY
done
