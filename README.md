# Zoh OS

A personal operating system for training, Gartner, income and weekly reviews. It's a static web app with no build step, served by GitHub Pages and installable on an iPhone home screen.

## Install on your phone
1. Open the live link in Safari.
2. Share → **Add to Home Screen**.
3. If the app opens empty, tap **Restore backup** and pick your latest `zoh-os-backup-*.json`. You only do this once per device.

Existing installs at the same address keep their data: the app reads the same storage key as v3 and upgrades it in place.

## What's in it
- **Today.** A week score out of 100, rings for gym, BJJ, Gartner and income, the next thing to do, this week's targets and recent activity.
- **Fast logging.** The + button opens one-tap entries for your usual gym splits and a single meeting, plus forms for gym, BJJ, meetings (a stepper, counted by month), income, closes, wins, PBs and injuries. Every change can be undone from the toast.
- **Train.** Gym sessions, physique rating, muscle coverage and injuries. BJJ shows the blue belt estimate from Mat Log's readiness model: mat time, technical skill, live performance and consistency, with projected dates. Link a Mat Log backup to add skill and roll results.
- **Money.** The path to your income target (no deadline unless you set one), income split by source, the Gartner bonus estimate and sales.
- **Gartner bonus.** Quarter attainment against 3 × the monthly meetings target. Payout is pro rata up to 100% and climbs to a 150% cap at 170%. Level 2 on-target bonus is the level 1 figure (£1,995 a quarter) plus 25%, so £2,493.75. All of these numbers can be changed in Settings.
- **Review.** A guided weekly review (the numbers, reflect, next week's targets), plus week, month and quarter scorecards with comparisons, live report cards, the week score trend, a training calendar and past reviews.
- **Goals.** Level and XP, which reward hitting targets rather than tapping. A win vault that also fills itself from your data (milestones, record months, quarter targets), and legacy goals.

## Data
- Everything lives on the device (`localStorage`, key `zoh-os-v3`). Nothing is sent anywhere.
- **Settings → Back up** saves a JSON file to Files or iCloud. The app reminds you when a backup is overdue.
- Upgrades never drop data. Before a format upgrade the old data is copied to `zoh-os-v3_pre_v4`, and restoring a backup keeps the previous data in `zoh-os-v3_before_restore`.

## Code
| File | Purpose |
|---|---|
| `index.html` | App shell |
| `css/app.css` | Design system (dark and light) |
| `js/store.js` | Storage, migration, date helpers |
| `js/belt.js` | Blue belt estimate, ported from Mat Log |
| `js/model.js` | Targets, scores, Gartner bonus, income, report cards, XP, wins (pure functions) |
| `js/ui.js` | Formatting, icons, toast/undo, sheets, SVG charts |
| `js/screens.js` | Today, Train, Money, Goals and Review |
| `js/sheets.js` | Quick log, edit, weekly review and settings sheets |
| `js/main.js` | Actions, input binding, backup/restore, startup |
| `sw.js` | Offline support and auto-updates |

Run the tests with `npm test` (Node 18+). There are no dependencies.

When you change any JS or CSS, bump the `?v=` query in `index.html` and the list in `sw.js` together with `CACHE`.
