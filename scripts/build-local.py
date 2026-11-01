from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
html=(dist/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(dist/'style.css').read_text()+'</style>')
def script(match):
    code=(dist/match.group(1)).read_text()
    return '<script>\n'+re.sub(r'</script',r'<\\/script',code,flags=re.I)+'\n</script>'
html=re.sub(r'<script src="([^"]+)"></script>',script,html)
html=html.replace('href="index.html"','href="#"').replace('href="ecdict-license.html"','href="https://github.com/skywind3000/ECDICT/blob/master/LICENSE"')
assert not re.search(r'<script\s+src=|<link[^>]+stylesheet',html)
out=root.parent/'outputs'/'WordNotes_Local.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out)
