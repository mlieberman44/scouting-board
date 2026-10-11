# Merges data/history/<year>.json (one file per past season, written by the history pull) into data/history.json,
# which make_page.py bakes into the board as DATA.history = {seasons: [...oldest first]}.
import json, glob, os
D = os.path.dirname(os.path.abspath(__file__))
seasons = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(D, 'history', '[0-9]*.json')))]
seasons.sort(key=lambda s: s['year'])
json.dump({'seasons': seasons}, open(os.path.join(D, 'history.json'), 'w'), separators=(',', ':'))
print('history.json:', ', '.join(f"{s['year']} ({len(s.get('teams', []))} teams, {len(s.get('matchups', []))} matchups)" for s in seasons))
