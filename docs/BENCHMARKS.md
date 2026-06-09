# Benchmarks

Context Fabric v1 now has a deterministic benchmark gate for the first token-reduction target:

```txt
median token reduction >= 75%
recall >= 90%
contamination == 0%
candidate leaks == 0
secret leaks == 0
```

## Read this before quoting the numbers

These numbers are **provisional engineering-gate results**, not broad production marketing claims yet.

The private core benchmark uses fictional corpora only (`acme-shop`, `other-co`) and compares Context Fabric against two baselines:

1. **Naive send-all baseline:** every available chunk in an intentionally noisy corpus. This is an adversarial upper-bound baseline; reduction scales with corpus noise.
2. **Same-scope baseline:** only chunks legitimately routable for the request's project/channel. This checks that the engine can reduce context even after foreign project/channel data is removed.

Before using the numbers publicly, the project should add larger public fixtures, publish CI-generated artifacts, and include corpus descriptions so the result is independently reproducible.

## Current private-core gate

Latest verified local core result:

```txt
Cases: 4
Target token reduction: 75.0%
Median token reduction vs naive send-all: 99.8%
Mean token reduction vs naive send-all: 99.8%
Min token reduction vs naive send-all: 99.8%
Median token reduction vs same-scope baseline: 99.4%
Recall: 100.0%
Contamination: 0.0%
Candidate leaks: 0
Secret leaks: 0
Verdict: PASS
```

## What this means

This proves the architecture can achieve the 75% reduction target on deterministic noisy corpora while preserving the safety gates above.

## What it does not mean yet

It does not yet prove the same reduction on arbitrary production traffic or against every realistic retrieval baseline.
