# MemoryDock

MemoryDock is a personal life tracker for quickly recording meals, macros, spending, moods, movement, sleep, habits, notes, and everyday memories.

## Current features

- Natural-language daily logging
- Meal macro estimates with editable calories, protein, carbs, and fat
- Spending tracking by amount, merchant, and category
- Monthly visual summaries for mood, movement, nutrition, spending, and sleep
- Separate Today, Timeline, Meals, Visuals, Spending, Profile, and Settings pages
- Voice input when supported by the browser
- Email accounts with secure, per-person cloud sync through Supabase
- Automatic migration of existing device-local logs after the first sign-in

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

## Supabase database and accounts

1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL editor.
3. Add these GitHub repository variables under Settings → Secrets and variables → Actions → Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The GitHub Pages workflow injects those public client values while building. Row Level Security in `supabase/schema.sql` ensures each signed-in person can only access their own profile and entries. If the variables are absent, MemoryDock keeps its existing device-local fallback for development.
