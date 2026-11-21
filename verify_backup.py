import json
from collections import Counter
from pathlib import Path

path = Path(__file__).parent / "data" / "gill-sports-state.json"
with path.open(encoding="utf-8") as f:
    state = json.load(f)
records = state["records"]
counts = Counter(r.get("result") for r in records)
print("Total forecasts:", len(records))
print("Results:", dict(counts))
settled = counts["Win"] + counts["Loss"]
print("Settled:", settled)
print("Hit rate:", f"{counts['Win'] / settled:.2%}" if settled else "N/A")
print("Sports:", dict(Counter(r.get("sport") for r in records)))
assert len(records) == 197
assert counts == {"Win": 117, "Loss": 54, "Pending": 26}
print("Backup verification passed")
