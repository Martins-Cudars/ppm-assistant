# Review Checklist

## Priorities

Review in this order:

1. Correctness and regressions
2. State and data consistency
3. Duplication and coupling
4. Performance and async behavior
5. Readability and local clarity

## Repo-Specific Checks

### Bootstrapping and routing

- Compare how each sport derives the active route.
- Check whether the same URL parsing logic appears in multiple places.
- Look for branches that drift in behavior between sports for no product reason.

### Data collection and cache integrity

- Verify the parse -> merge -> persist sequence preserves newer and more complete data.
- Check season rollover logic for stale carryover.
- Check behavior when `teamId` or current season day cannot be determined.
- Look for silent failures that only log and continue.

### Shared vs sport-specific code

- Flag shared modules that are coupled to hockey-only classes or settings.
- Check whether a generic layer would reduce duplication without hiding behavior.
- Prefer extraction only when it reduces repeated business rules, not just line count.

### UI and rendering

- Distinguish pure render helpers from DOM mutation with side effects.
- Check whether view modules own too many responsibilities.
- Watch for rendering code that depends on storage or route state implicitly.

### Types and maintainability

- Check for overly concrete types in shared paths.
- Check naming consistency for actions, views, and data shapes.
- Prefer direct, small modules over broad utility files with mixed concerns.

## Output Pattern

Use concise findings such as:

```text
Finding: Route parsing is duplicated and behaves differently in hockey and basketball.
Impact: New page support can diverge across sports and introduce silent misses.
Suggestion: Extract one shared route parser and keep sport-specific route tables local.
```

When helpful, add a compact architecture sketch:

```text
[sport init] -> [view] -> [parse] -> [merge] -> [cache] -> [store/UI]
```
