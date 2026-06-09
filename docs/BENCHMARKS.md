# Benchmarks

Context Fabric v1 now has a public, reproducible benchmark gate for reliability-first context selection. The first token-reduction target is tracked, but it is not allowed to override important context:

```txt
recall >= 90%
contamination == 0%
candidate leaks == 0
secret leaks == 0
```

The benchmark also reports whether the current corpus meets:

```txt
median token reduction >= 75%
median same-scope token reduction >= 75%
```

If preserving `must_keep` or `critical` chunks lowers the savings percentage, reliability wins. The report can show `reductionTargetMet=false` while the overall verdict still passes because the selected context stayed trustworthy.

## Read this before quoting the numbers

These numbers are **engineering-gate results**, not broad production marketing claims yet.

The public SDK benchmark uses fictional corpora only (`acme-shop`, `demo`, `other-co`, `example`) and compares Context Fabric against two baselines:

1. **Naive send-all baseline:** every available chunk in an intentionally noisy corpus. This is an adversarial upper-bound baseline; reduction scales with corpus noise.
2. **Same-scope baseline:** only chunks legitimately routable for the request's project/channel. This checks that the engine can reduce context even after foreign project/channel data is removed.

## Reproduce locally

```bash
npm ci
npm run benchmark -- artifacts/benchmarks
```

The command writes:

```txt
artifacts/benchmarks/benchmark-report.md
artifacts/benchmarks/benchmark-report.json
```

CI also uploads the same files as the `context-fabric-public-benchmark` artifact.

## Current verified public result

```txt
Cases: 12
Target token reduction: 75.0%
Median token reduction vs naive send-all: 99.8%
Mean token reduction vs naive send-all: 99.8%
Min token reduction vs naive send-all: 99.8%
Median token reduction vs same-scope baseline: 99.5%
Recall: 100.0%
Contamination: 0.0%
Candidate leaks: 0
Secret leaks: 0
Reliability gates: PASS
Token reduction target: MET
Verdict: PASS
```

## What this means

This proves the public SDK can achieve the 75% reduction target on deterministic noisy corpora while preserving the safety gates above. The product rule is reliability first: never sacrifice declared important context just to improve the percentage.

## What it does not mean yet

It does not yet prove the same reduction on arbitrary production traffic or against every realistic retrieval baseline. That comes after larger third-party-style corpora and published CI artifacts over time.
