# Agent preflight integration

The public SDK exposes a clean-room `runPreflight` helper for client/team demos. It accepts a message, explicit scope, memory records, and repo chunks, then returns selected chunks, a context pack, and agent-context text.

Candidates are excluded by default; cross-project records are always excluded.
