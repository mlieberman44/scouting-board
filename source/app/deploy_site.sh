#!/bin/bash
# Pushes the freshly built board (app/scouting-board.html from make_page.py) to the GitHub Pages site,
# repo mlieberman44/scouting-board (branch main), plus the app's source and league data in source/.
# The repo's CNAME file (custom domain) is left alone. Sign-in codes (app/team_codes.json, share/) never go in:
# the guard below refuses to push if any team code, or either private file, turns up anywhere in the repo.
set -e
R=/home/claude/scouting-board
if ! git -C "$R" rev-parse HEAD >/dev/null 2>&1; then rm -rf "$R"; git clone -q --depth 1 https://github.com/mlieberman44/scouting-board "$R"; fi
git -C "$R" fetch -q --depth 1 origin main && git -C "$R" reset -q --hard FETCH_HEAD
python3 /mnt/project-files/league/app/make_site.py "$R" >/dev/null
python3 - "$R" <<'PY'
import glob, json, os, shutil, sys
R, L = sys.argv[1], '/mnt/project-files/league'
# Only these files are published; backups (*.prev.*, dated copies, app_src.v*), __pycache__ and private files stay out.
KEEP = {'app': ['app_src.html', 'make_page.py', 'make_site.py', 'deploy_site.sh', 'REFRESH.md', 'dev/MODULES.md', 'mods/*.js'],
        'data': ['build.py', 'build_common.py', 'refresh.py', 'extra.py', 'merge_history.py', 'league_2027.json',
                 'history.json', 'nba_schedule_2027.json', 'draft_picks_by_id.json', 'draft_and_ros.json', 'draft_ids.txt',
                 'free_agents_br_2026.txt', 'rosters_raw.txt', 'roster_extra.txt', 'live.txt', 'records.txt',
                 'schedule_2027.txt', 'history/*.json']}
dst = os.path.join(R, 'source')
shutil.rmtree(dst, ignore_errors=True)
for top, pats in KEEP.items():
    for p in pats:
        for f in sorted(glob.glob(os.path.join(L, top, p))):
            out = os.path.join(dst, top, os.path.relpath(f, os.path.join(L, top)))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            shutil.copyfile(f, out)
CODES = os.path.join(L, 'app', 'team_codes.json')
codes = [c.strip().lower() for c in json.load(open(CODES))['codes'].values()] if os.path.exists(CODES) else []
for root, dirs, files in os.walk(R):
    dirs[:] = [d for d in dirs if d != '.git']
    for fn in files:
        rel = os.path.relpath(os.path.join(root, fn), R)
        if fn in ('team_codes.json', 'personal_links.md'):
            sys.exit('refusing to push: private file ' + rel)
        text = open(os.path.join(root, fn), 'rb').read().decode('utf-8', 'ignore').lower()
        if any(c and c in text for c in codes):
            sys.exit('refusing to push: a sign-in code appears in ' + rel)
PY
cd "$R" && git add -A
if git diff --cached --quiet; then echo "site unchanged"; exit 0; fi
git commit -q -m "Refresh board $(date -u +%Y-%m-%dT%H:%MZ)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01P8tS6XCzkkRKxSVcVaf9LC"
for i in 1 2 3 4; do git push -q origin main && { echo "pushed $(git rev-parse --short HEAD)"; exit 0; }; sleep $((2**i)); done
echo "push failed"; exit 1
