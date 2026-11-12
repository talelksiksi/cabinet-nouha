"""Détoure le logo (dent + implant) de la bannière : PNG transparent, sans le fond crème.

Chaque pixel est « démélangé » : pixel = a × encre + (1 − a) × fond, l'encre étant le bleu nuit ou l'or
de la marque. On garde la couleur pure de l'encre et a devient la transparence → bords nets, aucun halo.
Produit site/img/logo.png (bleu et or, fonds clairs) et site/img/logo-blanc.png (blanc et or, fonds sombres).
En attendant le fichier vectoriel officiel (SVG/PDF).

Usage : python tools/extract-logo.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'marque' / 'banniere-cabinet-bleu-or.jpg'
OUT = ROOT / 'site' / 'img'
BOX = (405, 50, 632, 222)          # zone du logo dans la bannière (1448 × 1086), au-dessus du texte
SCALE = 4                          # agrandi avant détourage pour des bords lisses
NAVY, GOLD = (22, 46, 90), (214, 166, 88)
WHITE = (255, 255, 255)
FINAL_W = 320


def unmix(p, ink, bg):
    d = [ink[i] - bg[i] for i in range(3)]
    v = [p[i] - bg[i] for i in range(3)]
    a = sum(v[i] * d[i] for i in range(3)) / sum(x * x for x in d)
    a = max(0.0, min(1.0, a))
    res = sum((v[i] - a * d[i]) ** 2 for i in range(3))
    return a, res


def main():
    im = Image.open(SRC).convert('RGB').crop(BOX)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    # Fond : moyenne locale des pixels clairs, par colonnes de 40 px (le fond est un léger dégradé)
    w, h = im.size
    px = im.load()
    bg_col = []
    for x in range(w):
        light = [px[x, y] for y in range(0, h, 3) if sum(px[x, y]) > 690]
        bg_col.append(tuple(sum(c[i] for c in light) / len(light) for i in range(3)) if light else (250, 246, 238))
    smooth = []
    for x in range(w):
        win = bg_col[max(0, x - 20):x + 21]
        smooth.append(tuple(sum(c[i] for c in win) / len(win) for i in range(3)))

    color = Image.new('RGBA', (w, h))
    white = Image.new('RGBA', (w, h))
    cp, wp = color.load(), white.load()
    for y in range(h):
        for x in range(w):
            bg = smooth[x]
            an, rn = unmix(px[x, y], NAVY, bg)
            ag, rg = unmix(px[x, y], GOLD, bg)
            a, ink, alt = (an, NAVY, WHITE) if rn <= rg else (ag, GOLD, GOLD)
            a = 0.0 if a < 0.10 else min(1.0, (a - 0.10) / 0.80)   # fond résiduel → transparent
            al = round(a * 255)
            cp[x, y] = (*ink, al)
            wp[x, y] = (*alt, al)

    bbox = color.getbbox()
    for img, name in ((color, 'logo.png'), (white, 'logo-blanc.png')):
        img = img.crop(bbox)
        img = img.resize((FINAL_W, round(img.height * FINAL_W / img.width)), Image.LANCZOS)
        img.save(OUT / name, optimize=True)
        print(name, img.size, round((OUT / name).stat().st_size / 1024), 'Ko')


if __name__ == '__main__':
    main()
