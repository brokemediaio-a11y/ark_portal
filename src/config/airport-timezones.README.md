# Airport time zones

`airport-timezones.json` contains only IATA → IANA time-zone mappings from https://github.com/mwgg/Airports (`airports.json`), downloaded 2026-11-09. MIT license: `airport-timezones.LICENSE`.

Source SHA-256: `a7754cbe722ea21f0f9ab1ef07f4f07ee1e85b9cc99191ebde0b49fabb3c149a`.

Empty codes/time zones and codes assigned to conflicting time zones are omitted. This is a local data snapshot; PDF rendering makes no external requests for timing calculations. The runtime’s IANA time-zone rules determine date-specific offsets and daylight saving time. Refresh the source periodically and retain the license. Unknown airports and ambiguous/nonexistent local timestamps do not produce inferred durations. Printed or flight-provider durations take precedence.
