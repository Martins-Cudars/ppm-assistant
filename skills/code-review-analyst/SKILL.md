---
name: code-review-analyst
description: Review code, explain how a codebase works, and identify bugs, regressions, hidden coupling, duplication, maintainability issues, refactor opportunities, and missing tests. Use when the user asks for a code review, architecture explanation, maintainability analysis, refactor suggestions, risk analysis, or wants an ASCII diagram of module or data flow.
---

# Code Review Analyst

## Overview

Analyze code with a reviewer mindset first: identify correctness risks, regressions, hidden coupling, missing validation, duplicated logic, and weak abstractions before giving stylistic advice.

Keep feedback short and dense. Prefer a few specific findings with evidence over broad commentary.

## Review Workflow

1. Build context from the requested files and the nearest entry points.
2. Explain the execution flow in plain language before proposing changes.
3. Prioritize findings by user impact:
   - correctness and regressions
   - data flow and state consistency
   - performance and unnecessary work
   - maintainability and duplication
   - style only when it affects clarity
4. Tie each finding to concrete files, functions, or module boundaries.
5. If architecture matters, include one ASCII diagram or chart instead of a long paragraph.

## Response Style

Write short but precise feedback.

Prefer this structure when reviewing code:

1. `How it works`
2. `Findings`
3. `Suggested improvements`
4. `ASCII diagram` when structure, control flow, or layering benefits from visualization

If there are no substantive findings, say that explicitly and note any remaining test or context gaps.

## ASCII Diagram Rules

Use ASCII only. Keep diagrams compact and readable in plain text.

Good cases:
- module dependencies
- request or render flow
- parse -> transform -> store pipelines
- duplicated branches across feature areas
- cache and persistence boundaries

Preferred shapes:

```text
main.ts
  |
  +--> hockey init ----> hockey views ----> storage/playerCache
  |
  +--> soccer init ----> soccer views
  |
  +--> basketball init -> basketball views
```

```text
[DOM/page parse] -> [player model] -> [dataMerger] -> [playerCache] -> [Pinia store/UI]
```

For comparisons, use tiny ASCII tables or bars:

```text
Area                 Risk   Note
bootstrapping        high   same routing logic repeated per sport
cache consistency    med    storage key and season logic are tightly coupled
render helpers       low    mostly isolated utility code
```

## Repository Guidance

For this repository, start with [references/project-architecture.md](references/project-architecture.md) when the user asks how the code works, where logic lives, or how modules relate.

Use [references/review-checklist.md](references/review-checklist.md) when the user asks for improvement ideas, code review, or maintainability feedback.

## Review Heuristics For This Repo

- Treat `src/main.ts` as the runtime dispatcher.
- Check for duplicated bootstrap and route matching logic across sports.
- Track the flow from DOM parsing to models to storage and then to store-driven UI.
- Watch for sport-specific code leaking into shared modules.
- Distinguish extension runtime concerns from pure calculations and view rendering.
- Pay attention to `chrome.storage.local` usage, stale cache handling, and season rollover behavior.
- Prefer recommendations that preserve the current project shape unless the duplication or coupling is material.

## Output Constraints

- Avoid long rewrites of the user's code.
- Do not flood the answer with generic best practices.
- Use concrete file references and direct statements.
- When suggesting refactors, explain the payoff in one sentence.
