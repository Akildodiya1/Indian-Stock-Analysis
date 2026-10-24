---
name: NSE shareholding payload
description: How the NSE top-corp-info endpoint reports per-company ownership.
---

NSE `top-corp-info` can omit flat promoter and public holding fields while returning shareholding in `shareholdings_patterns.data`, an object keyed by quarter-end date with label/value rows. Quarter-to-quarter promoter movement can be derived as a percentage-point difference between the latest two reported rows; pledged and institutional values may still be absent.

**Why:** Treating this response as a flat object made valid NSE ownership data look unavailable, while fabricating missing pledged or institutional figures would be misleading.

**How to apply:** Parse the dated shareholding pattern first, retain the reported date as the period, and leave absent categories explicitly unavailable. Distinguish percentage-point changes from percent returns.
