# Graph Report - backend  (2026-08-02)

## Corpus Check
- 147 files · ~126,365 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 113 nodes · 3 edges · 110 communities (1 shown, 109 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109

## God Nodes (most connected - your core abstractions)
1. `AIStyle` - 3 edges
2. `ControlNetEnhancementRequest` - 1 edges
3. `ControlNetEnhancementResult` - 1 edges
4. `StylePromptDefinition` - 1 edges
5. `AuthRequest` - 0 edges
6. `AppError` - 0 edges
7. `EnvConfig` - 0 edges
8. `resolveGoogleApiKey` - 0 edges
9. `validateEnv` - 0 edges
10. `getFirebaseAdmin` - 0 edges

## Surprising Connections (you probably didn't know these)
- `ControlNetEnhancementRequest` --references--> `AIStyle`  [EXTRACTED]
  src/services/AIEnhancer.ts → src/types/index.ts
- `ControlNetEnhancementResult` --references--> `AIStyle`  [EXTRACTED]
  src/services/AIEnhancer.ts → src/types/index.ts
- `StylePromptDefinition` --references--> `AIStyle`  [EXTRACTED]
  src/services/stylePromptLibrary.ts → src/types/index.ts

## Import Cycles
- None detected.

## Communities (110 total, 109 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.50
Nodes (4): ControlNetEnhancementRequest, ControlNetEnhancementResult, StylePromptDefinition, AIStyle

## Knowledge Gaps
- **112 isolated node(s):** `AuthRequest`, `AppError`, `EnvConfig`, `resolveGoogleApiKey`, `validateEnv` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **109 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `AuthRequest`, `AppError`, `EnvConfig` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._