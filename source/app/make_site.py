# Wraps the built board (scouting-board.html, which the Artifact host normally wraps in its own page skeleton) into a
# standalone index.html for hosting outside claude.ai, e.g. GitHub Pages.
#   python3 make_site.py [out_dir]   -> <out_dir>/index.html and .nojekyll (default app/site/)
import os, sys
APP = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(APP, 'site')
page = open(os.path.join(APP, 'scouting-board.html'), encoding='utf-8').read()
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="robots" content="noindex">\n'
        # the same small reset the Artifact host adds around every page
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n')
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(head + page.replace('<meta charset="utf-8">\n', '', 1) + '\n</body>\n</html>\n')
open(os.path.join(out, '.nojekyll'), 'w').close()
print('ok', os.path.join(out, 'index.html'))
