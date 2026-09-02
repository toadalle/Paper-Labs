# Architecture Amendment 001 — Market Data Provenance

## Decision

Every scored Arena must be bound to explicit immutable market-data provenance through a first-class `MarketDataSnapshot`.

`MarketDataSnapshot` records:
- provider
- feed
- symbol universe
- timeframe
- requested/actual coverage
- adjustment mode
- coverage/provider metadata
- fetched time
- canonical content hash
- schema version
- status
- superseded snapshot link
- immutable local artifact path

Arena references snapshot IDs. Experience also retains the exact snapshot IDs used.

## Revision behavior

Re-fetching the same request with different canonical data creates a new snapshot version. The old snapshot is not overwritten.

A normal provider correction creates a newer valid snapshot and supersession relationship. It does not retroactively mutate old Experiences.

`COMPROMISED` is reserved for evidence Paper Labs itself cannot trust, such as corrupted storage or a known ingestion bug.

Experiences referencing compromised data remain for audit history but cannot support promotion, benchmark, survival/reward claims, or deployment certification until re-evaluated.

## Canonical hash

Hash the normalized canonical research dataset, not arbitrary provider JSON transport bytes.

For scored research the normalized dataset artifact must be persisted locally; a future provider re-download is not sufficient for reproducibility.

## Provider boundary

`MarketDataProvider` is provider-neutral. Alpaca is the V1 implementation, not the definition of market data.

Capability states distinguish:
- AVAILABLE
- NOT_ENTITLED
- UNREACHABLE
- UNKNOWN

Secrets never enter provenance records, logs, diagnostics, exports, or collaboration files.
