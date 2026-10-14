#!/usr/bin/env python3
"""Génère les icônes de l'application installable du CRM (PWA) dans icons/.

Source UNIQUE : le logo par défaut du CRM, celui que `index.html` embarque déjà
(`DEFAULT_LOGO_DATAURI`, PNG 620x495 noir sur fond transparent : le monogramme MN + le texte
« MELISSA NABET / ARCHITECTURE & INTERIOR DESIGN »). Le texte est trop fin pour une icône : on ne
garde que le monogramme. `favicon.png` (256 px) n'est PAS utilisé : agrandi à 512 px il serait flou.

À relancer seulement si le logo par défaut ou ces couleurs changent :
    python3 scripts/generer-icones-pwa.py          (demande Pillow : pip install pillow)
puis relancer `node tests/pwa.test.mjs` : il vérifie tailles, fond et zone sûre.

Quatre fichiers, chacun pour un usage précis :
  icon-192.png / icon-512.png   (purpose "any")      l'icône ordinaire : bureau, liste des applis, Chrome
  icon-maskable-512.png         (purpose "maskable") Android découpe l'icône en rond, goutte, carré
                                                     arrondi… : tout le dessin doit tenir dans la
                                                     « zone sûre » (cercle de rayon 40 % de la largeur,
                                                     web.dev/articles/maskable-icon)
  apple-touch-icon.png (180)                         iPhone / iPad (« Sur l'écran d'accueil ») : opaque,
                                                     iOS arrondit lui-même les coins
"""
import base64
import io
import math
import os
import re
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, 'icons')

# --- Réglages (chacun nommé, rien de caché dans un calcul) -------------------------------------
# Fond des icônes = le fond de page réellement affiché par le CRM = `background_color` du manifeste :
# l'écran de démarrage de l'appli et son icône ont ainsi exactement la même couleur. C'est le
# `--travertine` APPLIQUÉ par le thème (applySiteTheme, palette « actuel » : #e9e4db, mesuré dans
# Chromium) et non celui écrit en dur dans le :root du CSS (#e8e2d7), remplacé au chargement.
FOND = (0xE9, 0xE4, 0xDB)
# Largeur du monogramme dans une icône ordinaire / iPhone, en part de la largeur de l'icône.
PART_ORDINAIRE = 0.72
# Zone sûre d'une icône « maskable » : cercle de rayon 40 % de la largeur (web.dev). On vise 38 %
# pour garder une marge de sécurité contre l'anti-crénelage et les masques les plus serrés.
RAYON_SUR = 0.40
RAYON_VISE = 0.38
# Un pixel compte comme « du dessin » au-dessus de ce niveau d'opacité (0-255).
SEUIL_ALPHA = 8
# Vide minimal (en lignes de pixels) qui sépare le monogramme du texte dans le logo.
VIDE_MIN = 15


def lire_logo():
    """Le logo par défaut, tel qu'embarqué dans index.html (RGBA)."""
    html = open(os.path.join(RACINE, 'index.html'), encoding='utf-8').read()
    m = re.search(r"const DEFAULT_LOGO_DATAURI='data:image/png;base64,([A-Za-z0-9+/=]+)'", html)
    if not m:
        sys.exit("DEFAULT_LOGO_DATAURI introuvable dans index.html : le logo par défaut a changé de place.")
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')


def monogramme(logo):
    """Le monogramme seul : les lignes du haut, jusqu'au premier grand vide (avant le texte)."""
    alpha = logo.getchannel('A')
    largeur, hauteur = alpha.size
    acces = alpha.load()
    vide = 0
    bas = None
    for y in range(hauteur):
        if any(acces[x, y] > SEUIL_ALPHA for x in range(largeur)):
            vide = 0
        else:
            vide += 1
            if vide >= VIDE_MIN:
                bas = y - vide + 1
                break
    if bas is None:
        sys.exit("Le monogramme n'est pas séparé du texte par un vide : le logo par défaut a changé.")
    haut = logo.crop((0, 0, largeur, bas))
    boite = haut.getchannel('A').point(lambda v: 255 if v > SEUIL_ALPHA else 0).getbbox()
    return haut.crop(boite)


def points_du_dessin(mono):
    acces = mono.getchannel('A').load()
    return [(x, y) for y in range(mono.height) for x in range(mono.width) if acces[x, y] > SEUIL_ALPHA]


def rayon_depuis_le_centre(points, largeur, hauteur):
    """Distance du dessin le plus éloigné du centre de la boîte du monogramme."""
    cx, cy = largeur / 2, hauteur / 2
    return max(math.hypot(x - cx, y - cy) for x, y in points)


def composer(mono, taille, largeur_mono):
    """Icône carrée `taille` : fond plein, monogramme de largeur `largeur_mono`, centré."""
    f = largeur_mono / mono.width
    redim = mono.resize((round(mono.width * f), round(mono.height * f)), Image.LANCZOS)
    x = round((taille - redim.width) / 2)
    y = round((taille - redim.height) / 2)
    toile = Image.new('RGBA', (taille, taille), FOND + (255,))
    toile.alpha_composite(redim, (x, y))
    return toile.convert('RGB')


def main():
    os.makedirs(SORTIE, exist_ok=True)
    mono = monogramme(lire_logo())
    rayon = rayon_depuis_le_centre(points_du_dessin(mono), mono.width, mono.height)

    # Icône « maskable » : tout le dessin (ses pieds, en bas à gauche et à droite, sont ses points
    # les plus éloignés du centre) dans le cercle de rayon RAYON_VISE. Centrée sur la boîte du
    # monogramme : centrée sur le plus petit cercle englobant, elle gagnait 7 % de largeur mais
    # paraissait trop haute (essai du 14 oct. 2026, comparé à l'œil sur un masque rond).
    if RAYON_VISE > RAYON_SUR:
        sys.exit("RAYON_VISE dépasse la zone sûre des icônes maskable (RAYON_SUR).")
    taille_m = 512
    echelle_m = (RAYON_VISE * taille_m) / rayon
    maskable = composer(mono, taille_m, mono.width * echelle_m)

    fichiers = {
        'icon-192.png': composer(mono, 192, 192 * PART_ORDINAIRE),
        'icon-512.png': composer(mono, 512, 512 * PART_ORDINAIRE),
        'icon-maskable-512.png': maskable,
        'apple-touch-icon.png': composer(mono, 180, 180 * PART_ORDINAIRE),
    }
    for nom, image in fichiers.items():
        chemin = os.path.join(SORTIE, nom)
        image.save(chemin, optimize=True)
        print('✓', os.path.relpath(chemin, RACINE), image.size, os.path.getsize(chemin), 'octets')
    print('monogramme source : %d x %d px ; point le plus éloigné du centre : %.1f px ; maskable : monogramme à %.0f %% de la largeur, zone sûre visée %.0f %%'
          % (mono.width, mono.height, rayon, 100 * mono.width * echelle_m / taille_m, RAYON_VISE * 100))


if __name__ == '__main__':
    main()
