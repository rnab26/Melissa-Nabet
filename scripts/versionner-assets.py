#!/usr/bin/env python3
"""Écrit dans index.html l’empreinte de assets/crm.css, i18n.js, i18n-he.js et assets/crm.js (?v=…).

Pourquoi : la détection « nouvelle version disponible » du CRM compare l'ETag de index.html.
Depuis que le CSS et le JS sont des fichiers à part, une modification qui ne touche qu'eux
laisserait index.html identique : aucune bannière, et GitHub Pages garde l'ancien fichier en cache
10 minutes. Avec l'empreinte dans l'adresse, tout changement de CSS/JS change index.html.

À lancer avant de commiter un changement de assets/crm.css ou assets/crm.js.
`--verifier` ne modifie rien et sort en erreur si l'empreinte est périmée (utilisé par les tests).
"""
import hashlib, re, sys, pathlib

racine = pathlib.Path(__file__).resolve().parent.parent
page = racine / "index.html"
html = page.read_text(encoding="utf-8")

def empreinte(chemin):
    return hashlib.sha1((racine / chemin).read_bytes()).hexdigest()[:10]

nouveau = html
for chemin in ("assets/crm.css", "i18n.js", "i18n-he.js", "assets/crm.js"):
    motif = re.compile(r'(%s)(\?v=[0-9a-f]+)?"' % re.escape(chemin))
    if not motif.search(nouveau):
        sys.exit("introuvable dans index.html : " + chemin)
    nouveau = motif.sub(lambda m: '%s?v=%s"' % (m.group(1), empreinte(chemin)), nouveau)

if "--verifier" in sys.argv:
    if nouveau != html:
        sys.exit("empreintes périmées : lance scripts/versionner-assets.py")
    print("empreintes à jour")
elif nouveau != html:
    page.write_text(nouveau, encoding="utf-8")
    print("index.html mis à jour")
else:
    print("déjà à jour")
