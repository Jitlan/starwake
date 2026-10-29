"""Starts a new arcade game from games/_template.
Usage: python3 tools/new_game.py <id> "<Title>"
<id> becomes the folder (games/<id>/), the URL path in the arcade and the start of the save key, so keep it short,
lowercase and permanent: renaming it later moves the game to a new URL and orphans players' saves."""
import os,re,shutil,sys
here=os.path.dirname(os.path.abspath(__file__))
root=os.path.dirname(here)
if len(sys.argv)!=3: sys.exit(__doc__)
gid,title=sys.argv[1],sys.argv[2]
if not re.fullmatch(r'[a-z][a-z0-9-]{1,30}',gid): sys.exit('id must be lowercase letters, digits or dashes, starting with a letter')
dst=os.path.join(root,'games',gid)
if os.path.exists(dst): sys.exit(dst+' already exists')
shutil.copytree(os.path.join(root,'games','_template'),dst,ignore=shutil.ignore_patterns('README.md'))
for f in os.listdir(dst):
    p=os.path.join(dst,f)
    s=open(p).read().replace('__ID__',gid).replace('__TITLE__',title)
    open(p,'w').write(s)
print('Created games/'+gid+'/. Edit game.json, shell.html and game.js, then run python3 tools/build.py.')
