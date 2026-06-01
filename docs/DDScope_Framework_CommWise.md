# DDScope — Framework CommWise

## Quick Start
DDScope-specific parameters for the CommWise framework.
See `conventions/commwise-framework.md` in the knowledge base for the full framework convention (block model, assembly, synchronisation, session lifecycle, best practices).

## DDScope-specific parameters

| Parameter | Value |
|---|---|
| CommWise app ID | `22645` |
| Correspondence file | `src/frameworks/commwise/sync-tracker.md` |

The correspondence file maps each `src/` module to its CommWise block address and tracks synchronisation state.
See `src/frameworks/commwise/sync-tracker.md` for the full tracking table.

## AI Proxy

Direct Anthropic API calls are CORS-blocked from CommWise. Always use the CommWise secure request proxy:

```javascript
commwiseConfigClient.secureRequest('C3', 'CLAUDE', {
  method: 'POST',
  endpointSuffix: 'v1/messages',
  headers: {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: { ... }
})
```

## Changelog

### Version 2.0 - AI Proxy added, DDScope_CommWise.md deleted
**Date:** 2026-06-01
**Reason:** DDScope_CommWise.md deleted — generic content moved to conventions/commwise-framework.md (KB). AI Proxy section (DDScope-specific credentials) moved here.

**Changes:**
- Added: DDScope-specific parameters table (app ID, correspondence file)
- Added: AI Proxy section with secureRequest pattern

### Version 1.0 - Creation
**Date:** 2026-06-01
**Reason:** Stub created pointing to conventions/commwise-framework.md.
