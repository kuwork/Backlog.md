---
title: BACK-626 Resolve open Dependabot alerts (mermaid bump)
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels:
  - source
  - security
  - dependencies
  - build
source_path: backlog/tasks/back-626 - Resolve-open-Dependabot-alerts.md
---

# BACK-626 Resolve open Dependabot alerts (mermaid bump)

Five published advisories affected the pinned mermaid `11.15.0` — radar-diagram DoS, configuration prototype pollution, CSS injection reaching sibling elements, architecture-diagram prototype pollution, and XY-chart infinite-loop DoS. Mermaid is not dev-only in the shipped artifact: `src/web/utils/mermaid.ts` imports the prebuilt browser bundle, the bundle is embedded in the compiled CLI binary, and it renders task/document markdown in the loopback web UI. `securityLevel strict` blocks script injection but not the CSS or prototype-pollution issues.

## Summary

- Bumped the direct dependency `mermaid` from `11.15.0` to exactly `11.16.1` — the version that patches all five GHSAs (`GHSA-rhh3-jpg6-66xh`, `GHSA-c4c3-pg64-4m4v`, `GHSA-6x64-9x62-f2gx`, `GHSA-3rrr-jr9j-h3q3`, `GHSA-2v8p-3f2j-5mp7`); an advisory-database scan showed no open advisories against `11.16.1`
- Version choice: `11.17.2` was the newest clean 11.x, but `11.16.1` already carried a published deep supply-chain verification and five weeks of public exposure
- `bun.lock` regenerated: the bump-attributable delta is 7 insertions covering only the mermaid subtree (mermaid, `@braintree/sanitize-url`, `@mermaid-js/parser`, `cytoscape`, `dayjs`, `katex`, root spec); the 150 deleted lines are orphaned-entry pruning that a plain `bun i` reproduces on the unmodified tree
- `bun.nix`: the six mermaid-subtree entries were updated by hand because the generator needs Docker or Nix (unavailable); every hash byte-matches the lockfile's sha512 integrity and the block structure stays generator-produced
- Verification: typecheck, Biome, `src/test/mermaid.test.ts` (3 pass), full `bun run build` (binary refreshed, reports `1.50.1-CN`, contains 11.16.1 markers); remaining full-suite failures reproduce on pristine dependencies under low-memory conditions
- Fork gap noted: `bun.nix` has no CI validation in this fork (no nix job, no bun2nix guard), so the byte-for-byte lock-integrity cross-check is the only local guarantee

## Acceptance Criteria

- mermaid resolves to >= 11.16.1 with no known open advisories in `package.json` and `bun.lock`
- Lockfile delta attributable to the bump touches only the mermaid subtree
- Mermaid rendering still works and `src/test/mermaid.test.ts` passes
- The compiled binary builds after the bump and `bun.nix` is regenerated for the mermaid subtree only

## Related Concepts

- [[concepts/web-ui-features]] — mermaid rendering is a listed Web UI technical feature this bump protects
- [[concepts/ci-platform-contracts]] — where the missing Nix validation job would belong in this fork
- [[concepts/core-architecture]] — build/embedding path that puts the mermaid bundle inside the CLI binary

## Related Sources

- [[sources/back-553-modernize-browser-bundling]] — BACK-553 Bun.build pipeline whose bundle carries mermaid into the binary
