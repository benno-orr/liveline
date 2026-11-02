# Liveline

Native macOS app for the personal Notion agenda, drawn as an arcade-style invader field: tasks descend toward today, and finished tasks can be shot down for points. Installed at `~/Applications/Liveline.app`.

The personal snapshot (`Resources/snapshot.json`) is gitignored, so a fresh clone starts with an empty field until a Notion token is added under **Connection**.

## Run and rebuild

Open Liveline from your personal Applications folder or Spotlight. Rebuild with `./build.sh`; install with `./build.sh --install`. Requires macOS and Xcode Command Line Tools. There are no package dependencies. Run date/mapping checks with `node tests/logic.test.js`.

## Notion connection

The app includes a complete 22-row snapshot of the active view imported on October 15, 2026. Open **Connection** to configure an internal Notion integration, share the agenda with it, and paste its token. The token is stored in macOS Keychain, never in source files or the web UI after saving. Refresh runs on launch and every five minutes while running. No writes to Notion are made.

Database: `5ccb86c0-70be-4b48-bb40-e594d2297a97`
Data source: `89bdeda5-7ece-4c20-bc83-9c3fd6e1b79c`
Original view: `2c7b61d0-ff40-8025-8ac4-000cb9e4aafa`

Uses the official [query data source API](https://developers.notion.com/reference/query-a-data-source) with pagination and API version 2025-09-03. Runtime filtering matches the current active view by excluding DONE, ~done, missed, and abandon. Later changes to the saved view filters are not automatically imported.

## Mapping (invader field)

- Height: days until hard deadline, falling back to soft deadline. Invaders descend toward the TODAY line; overdue ones have landed on it and drop bombs on their building. Dropdowns can select hard or soft only and a 7/30/90/365-day horizon.
- Lane (left → right): filled stars in severity: 0 field, 1 shed, 2 house, 3 city block, 4 big city. Each severity has its own invader sprite.
- Missing severity is explicitly unset; those tasks remain in the searchable list.
- Undated tasks stay in the searchable list.
- Overdue points clamp to today; deadlines beyond the horizon clamp to the far edge. Details preserve exact dates. Date ranges use their end.
- Date-only deadlines use local calendar days; timed deadlines use their actual instant.

The cached live response is stored with mode 0600 at `~/Library/Application Support/Liveline/agenda.json`. Failed refreshes retain the previous map. The initial personal snapshot is bundled in the app: do not distribute this build or the snapshot publicly.

## Shooting down finished tasks

Each sync also fetches tasks marked DONE or ~done that were edited in the last 14 days (missed and abandon are never targets). They appear as cyan ✓ invaders. Move the cannon with ←/→ (or A/D) and fire with Space, click empty sky to move and fire, or click a ✓ invader (or **Shoot it down** in the side panel) to auto-aim. Shots at active tasks bounce off. Points come from **benefit**: 10/20/40/70/100 for levels 0–4 (10 when unset), +25 if the task's last edit was on or before its deadline. Every invader shows a 4-segment worth bar (green → orange as benefit rises), also shown in the task list and side panel. Score and shot-down IDs are saved in the app's UserDefaults (key `game`) and pruned once a task leaves the 14-day window. **Practice** launches three training drones worth no points. Still read-only: nothing is written to Notion.

### Benefit column

Each sync uses the first Notion property whose name contains "benefit" (case-insensitive), so renaming it, for example to "Benefit ($)", keeps working. Accepted formats: stars (★★☆), numbers or number formulas/rollups (scale auto-detected from the values present: 0–1, 0–4, 1–5, 0–10, 0–100), select/status/text words (none, low, medium, high, very high), or repeated symbols (💰💰💰, $$). Unreadable or empty values show a hollow bar. The field footnote says so if no benefit column is found. Besides the five-minute timer and launch, the app also refreshes when you switch back to it, at most once a minute.

## Verification and limits

Compiled and ad-hoc signed on this Mac. Verified app launch, real snapshot rendering, and missile selection in the installed app. Unit checks cover all severity levels, unset severity, date boundaries, daylight saving, fallback selection, and completed status filtering. Live API authentication cannot be verified until a token is supplied in the app. This local build is not notarized for distribution.
