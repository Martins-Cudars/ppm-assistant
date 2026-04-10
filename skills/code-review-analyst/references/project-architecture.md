# Project Architecture

## Overview

This repository is a browser-extension style frontend for PowerPlay Manager pages. The runtime chooses a sport-specific initializer based on the current host, then each sport module decides which page/view logic to run from the current URL.

## Top-Level Flow

```text
src/main.ts
  |
  +--> hockey.powerplaymanager.com     -> src/sports/hockey/hockey.ts
  +--> soccer.powerplaymanager.com     -> src/sports/soccer/soccer.ts
  +--> basketball.powerplaymanager.com -> src/sports/basketball/basketball.ts
```

## Main Layers

```text
[page URL + DOM]
      |
      v
[sport initializer]
      |
      v
[view module]
      |
      +--> parse page data / build player objects
      +--> render UI pieces
      +--> persist data for later pages
```

## Shared Areas

- `src/base/`
  Shared calculations, rendering helpers, and generic utilities.
- `src/utils/`
  DOM helpers, parsing helpers, and cross-cutting functions.
- `src/storage/`
  `chrome.storage.local` abstraction, storage keys, serialization, and user settings.
- `src/services/`
  Data orchestration such as collect -> merge -> persist.
- `src/stores/`
  Pinia state for extension pages and cache-backed UI.
- `src/types/`
  Cross-module types.

## Sport-Specific Areas

- `src/sports/hockey/`
  Most complete vertical slice. Includes routes, settings, calculations, view modules, Vue components, and player classes.
- `src/sports/soccer/`
  Similar initializer/view shape but lighter shared infrastructure.
- `src/sports/basketball/`
  Similar route-based bootstrapping with some commented or incomplete branches.

## Hockey Data Path

```text
[Hockey view]
   |
   v
[HockeyPlayer]
   |
   v
[services/dataCollector.ts]
   |
   v
[services/dataMerger.ts]
   |
   v
[storage/playerCache.ts]
   |
   v
[stores/playerStore.ts]
   |
   v
[extension page / Vue components]
```

## Review Hotspots

- Repeated route extraction and initializer logic across sports.
- Shared modules that currently import hockey-specific types or settings.
- Cache lifecycle:
  `storageKeys` + `playerCache` + season-day logic + invalid cache cleanup.
- Boundaries between DOM parsing, persistence, and rendering.
- Mixed responsibility inside view files when they both parse data and mutate UI.
