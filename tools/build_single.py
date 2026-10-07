"""Bundle index.html + all scripts/styles into one self-contained Blockhollow.html."""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = lambda f: os.path.join(root, f)
h = open(p('index.html')).read()
h = h.replace('<link rel="stylesheet" href="src/style.css">', '<style>\n' + open(p('src/style.css')).read() + '\n</style>')
h = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + open(p(m.group(1))).read().replace('</script>', '<\\/script>') + '\n</script>', h)
import base64
h = re.sub(r'src="(assets/[^"]+\.(jpg|png))"', lambda m: 'src="data:image/' + ('jpeg' if m.group(2) == 'jpg' else 'png') + ';base64,' + base64.b64encode(open(p(m.group(1)), 'rb').read()).decode() + '"', h)
open(p('Blockhollow.html'), 'w').write(h)
print('Blockhollow.html', len(h) // 1024, 'KB')
