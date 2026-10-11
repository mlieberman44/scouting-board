# Scouting Board

Matt's fantasy basketball scouting board for ESPN league 99907173: matchups, power rankings, waivers, trades and a Stats lab where every number opens a breakdown. Each manager signs in with their own team.

Live at https://mlieberman44.github.io/scouting-board/

## What's here

- `index.html` is the built board, with the league data baked in. It is generated, so don't edit it here.
- `source/` is the code and data it is built from, copied in on every refresh:
  - `source/app/app_src.html` is the core app, and `source/app/mods/` holds its modules (matchups, teams, players, Stats lab).
  - `source/app/make_page.py` inlines the modules and data into one page; `make_site.py` wraps it for GitHub Pages; `deploy_site.sh` pushes it here.
  - `source/app/REFRESH.md` is the refresh runbook, and `source/app/dev/MODULES.md` documents the module system.
  - `source/data/` holds the build scripts and the league data: rosters, schedule, draft, and league history from 2019 to 2026.

The board refreshes from ESPN three times a day. Sign-in codes are not in this repo; the page only carries their hashes.
