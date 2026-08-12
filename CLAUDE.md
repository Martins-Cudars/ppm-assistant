# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension that enhances PowerPlay Manager (PPM) browser game by parsing DOM data and adding/replacing game UI elements with Vue components. Supports hockey, soccer, and basketball across multiple languages (Latvian, English).

## Commands

```bash
pnpm dev        # Build with watch mode for development
pnpm build      # Production build to ./dist
pnpm lint       # ESLint
pnpm type-check # TypeScript type checking
```

After building, load `./dist` folder as unpacked extension in `chrome://extensions`.

## Architecture

**Entry point**: `src/main.ts` detects sport subdomain (hockey/soccer/basketball.powerplaymanager.com) and calls the appropriate init function.

**Sport modules** (`src/sports/{sport}/`):
- `{sport}.ts` - Init function that matches current URL against routes and calls view functions
- `routes.ts` - URL patterns for each page (must include all supported language variants)
- `views/` - Page-specific functions that parse DOM and inject Vue components
- `classes/` - Player data models extending `BasePlayer`
- `settings.ts` - Sport-specific constants

**Content script injection** (`src/manifest.json`):
- CSS injected at `document_start` can hide original elements before render
- Use `include_globs` to target specific pages for CSS injection
- JS (`main.js`) runs at `document_idle`

**Vue components**: Located in `views/components/`, mounted into containers inserted near original game elements.

## Key Patterns

**Adding a new view**:
1. Add URL patterns for all languages to `routes.ts`
2. Create view function in `views/` that parses DOM and mounts Vue component
3. Add route check in sport's init function
4. If hiding original elements, add CSS rules and `include_globs` in manifest

**URL matching**: Routes use path without `.html` extension. The regex in init functions extracts `/lang/page-name` from URLs.

## Known Issues

See `docs/known-issues.md` for bugs that were investigated but not resolved, including current hypotheses and what's already been ruled out. Check it before re-investigating a bug from scratch.
