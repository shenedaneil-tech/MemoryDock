# MemoryDock

MemoryDock is a personal life tracker for quickly recording meals, macros, spending, moods, movement, sleep, habits, notes, and everyday memories.

## Current features

- Natural-language daily logging
- Meal macro estimates with editable calories, protein, carbs, and fat
- Spending tracking by amount, merchant, and category
- Monthly visual summaries for mood, movement, nutrition, spending, and sleep
- Separate Today, Timeline, Meals, Visuals, Spending, Profile, and Settings pages
- Voice input when supported by the browser
- Device-local profile and saved data

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

The standard build uses Vinext and produces a Cloudflare Worker-compatible app. The `build:pages` script creates a static export for GitHub Pages. Every push to `main` runs the included deployment workflow and publishes the site at [shenedaneil-tech.github.io/MemoryDock](https://shenedaneil-tech.github.io/MemoryDock/).

## Data storage

MemoryDock currently stores profile information and logs in the browser on the current device. Account-based syncing across devices will require authentication and a hosted database.
