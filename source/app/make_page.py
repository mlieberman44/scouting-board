# Builds the publishable page: app_src.html with league_2027.json (plus the NBA schedule and league history, when present) baked in,
# and every module in the modules folder (*.js) inlined as its own <script> between the core script and the boot script,
# so a module that fails to load can't take the rest of the board down with it.
#   python3 make_page.py                         -> app/scouting-board.html from app/app_src.html and app/mods/
#   python3 make_page.py --out /tmp/x.html       -> a test build somewhere else
#   python3 make_page.py --src S --modsdir D     -> build from another source file and modules folder (the dev copy in app/dev/)
#   python3 make_page.py --mods a,b              -> only these modules (file names without .js); --mods none for the core alone
import json, os, sys, glob, datetime
APP = '/mnt/project-files/league/app/app_src.html'
MODS = '/mnt/project-files/league/app/mods'
DATA = '/mnt/project-files/league/data/league_2027.json'
NBA = '/mnt/project-files/league/data/nba_schedule_2027.json'
HIST = '/mnt/project-files/league/data/history.json'
CODES = '/mnt/project-files/league/app/team_codes.json'   # private sign-in codes; only their hashes reach the page
OUT = '/mnt/project-files/league/app/scouting-board.html'

args = sys.argv[1:]
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args else default
src, modsdir, out, only = opt('--src', APP), opt('--modsdir', MODS), opt('--out', OUT), opt('--mods')

s = open(src).read()
d = json.load(open(DATA))
if os.path.exists(NBA):
    n = json.load(open(NBA))
    am = n.get('abbrevMap') or {}
    teams = {am.get(k, k): sorted(set(int(x) for x in v)) for k, v in n['teams'].items()}
    nba = {'teams': teams}
    # scoring period 1's calendar date (Eastern): anchor game time minus (period - 1) days, shifted 5h so evening tips stay on their ET date
    a = (n.get('anchors') or [None])[0]
    if a:
        ms = a['dateMs'] - (a['scoringPeriod'] - 1) * 86400000
        nba['day1'] = (datetime.datetime.utcfromtimestamp(ms / 1000) - datetime.timedelta(hours=5)).date().isoformat()
    # ESPN's own matchupPeriods map holds week indices, not days; the schedule file carries the day lists separately
    mp = n.get('matchupPeriodScoringPeriods') or n.get('matchupPeriods') or {}
    # keep only periods whose values are scoring-period lists (days), not single matchup ids
    if mp and all(isinstance(v, list) and v for v in mp.values()) and max(len(v) for v in mp.values()) > 1:
        nba['periods'] = {str(k): sorted(int(x) for x in v) for k, v in mp.items()}
    d['nba'] = nba
    print('nba schedule:', len(teams), 'teams,', sum(len(v) for v in teams.values()) // 2, 'games, day1', nba.get('day1'), ', periods', len(nba.get('periods', {})))
has_mods = '<!--MODULES-->' in s
if has_mods and os.path.exists(HIST):
    d['history'] = json.load(open(HIST))
    print('history:', len(d['history'].get('seasons', [])), 'seasons')
if 'const AUTH=' in s and os.path.exists(CODES):
    import hashlib
    codes = json.load(open(CODES))['codes']
    d['auth'] = {k: hashlib.sha256(f'sb99907173:{k}:{v.strip().lower()}'.encode()).hexdigest() for k, v in codes.items()}
    print('sign-in:', len(d['auth']), 'team codes')
assert s.count('/*DATA*/null') == 1
s = s.replace('/*DATA*/null', json.dumps(d, separators=(',', ':')).replace('</', '<\\/'))

if has_mods:
    files = sorted(glob.glob(os.path.join(modsdir, '*.js')))
    if only is not None:
        keep = set() if only == 'none' else set(x.strip() for x in only.split(','))
        files = [f for f in files if os.path.basename(f)[:-3] in keep]
    blocks = []
    for f in files:
        code = open(f).read()
        assert '</script' not in code.lower(), f + ' contains a closing script tag'
        blocks.append('<script>/* module: %s */\n%s\n</script>' % (os.path.basename(f), code))
    assert s.count('<!--MODULES-->') == 1
    s = s.replace('<!--MODULES-->', '\n'.join(blocks))
    print('modules:', ', '.join(os.path.basename(f)[:-3] for f in files) or 'none')
open(out, 'w').write(s)
print('ok', out)
