---
name: Yahoo fundamentals fallbacks
description: Durable constraints for filling missing Indian stock ratios from Yahoo Finance.
---

Yahoo Finance’s quote summary can omit PEG, ROE, ROA, and current ratio even when the underlying annual financial statements contain enough data to calculate them. The fundamentals-timeseries endpoint is the reliable fallback. Broad `type=` requests can return multiple result records, but unsupported type names may silently produce metadata-only entries, so verify each requested series and parse every result record.

**Why:** The stock detail UI otherwise renders legitimate but incomplete API responses as dashes, which looks like a loading failure to users.

**How to apply:** Prefer summary values first. When absent, derive ratios only from reported statement values and verify the exact Yahoo type names; derive PEG only when positive earnings growth is available. Treat `.next` as generated cache output and clear it before restarting dev if a vendor-chunk module error appears after a production build.