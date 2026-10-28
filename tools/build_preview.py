"""Construit dist/preview.html : la page sans son enveloppe <html>/<head>/<body>,
pour la publier comme aperçu (l'hébergeur ajoute sa propre enveloppe)."""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
head = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", head)
out = root / "dist" / "preview.html"
out.parent.mkdir(exist_ok=True)
out.write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
print(out)
