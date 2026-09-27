"""
La palette de la forge : les couleurs du style « île douillette ».

Le style visé (voir `docs/FORGE_ASSETS.md`) tient d'abord à sa palette : des
verts tendres et saturés, une terre rousse, un sable pâle, des bois miel, des
pierres gris chaud, et quelques accents francs — un rouge brique, une
lavande, un jaune tournesol. Pas de texture : chaque matière est une couleur
unie, l'ombre et le relief font le reste.

Chaque couleur a un **nom de matière** stable. Le jeu retrouve les matières par
ce nom : c'est ce qui permet de repeindre un décor à la saison (le feuillage
qui roussit à l'automne) sans le recharger — voir `SAISONS` et
`teinterSaison()` côté web.

Les valeurs sont en sRGB, comme on les lit sur une capture ; `lineaire()` les
convertit pour Blender et glTF, qui travaillent en linéaire.
"""

from __future__ import annotations

# nom → (couleur sRGB, rugosité, métal, émission, opacité, deux faces)
# Une émission > 0 fait briller la matière (lanternes, fenêtres la nuit) ;
# une opacité < 1 la rend translucide (verre) ; « deux faces » sert aux lames
# fines qu'on voit des deux côtés (feuilles, pétales, toiles).
COULEURS: dict[str, tuple] = {
    # Le sol
    "herbe": (0x8fc257, 0.95, 0.0, 0.0, 1.0, False),
    "herbe-sombre": (0x6fa343, 0.95, 0.0, 0.0, 1.0, False),
    "brin": (0x7db84a, 0.9, 0.0, 0.0, 1.0, True),
    "terre": (0x9c5f3a, 0.95, 0.0, 0.0, 1.0, False),
    "terre-claire": (0xb97c4c, 0.95, 0.0, 0.0, 1.0, False),
    "sable": (0xe9d9a4, 0.95, 0.0, 0.0, 1.0, False),
    "eau": (0x6cc9d6, 0.15, 0.0, 0.0, 0.85, False),
    # Le végétal
    "feuillage": (0x7cb446, 0.85, 0.0, 0.0, 1.0, False),
    "feuillage-clair": (0x9ccb5a, 0.85, 0.0, 0.0, 1.0, False),
    "feuillage-sombre": (0x5c9138, 0.85, 0.0, 0.0, 1.0, False),
    "sapin": (0x4d8a4a, 0.85, 0.0, 0.0, 1.0, False),
    "ecorce": (0x6e4631, 0.9, 0.0, 0.0, 1.0, False),
    "roseau": (0x8a9a4a, 0.9, 0.0, 0.0, 1.0, True),
    "massette": (0x6a4128, 0.9, 0.0, 0.0, 1.0, False),
    "lavande": (0x8b7bd0, 0.8, 0.0, 0.0, 1.0, False),
    "tournesol": (0xf3c332, 0.8, 0.0, 0.0, 1.0, True),
    "coquelicot": (0xe2493a, 0.8, 0.0, 0.0, 1.0, True),
    "marguerite": (0xf6f1e6, 0.8, 0.0, 0.0, 1.0, True),
    "coeur-fleur": (0xf0b92c, 0.8, 0.0, 0.0, 1.0, False),
    "rose": (0xf2a39a, 0.8, 0.0, 0.0, 1.0, False),
    "citrouille": (0xe8832c, 0.7, 0.0, 0.0, 1.0, False),
    "paille": (0xe2bf72, 0.95, 0.0, 0.0, 1.0, False),
    "paille-sombre": (0xc49a4e, 0.95, 0.0, 0.0, 1.0, False),
    # Le bâti
    "bois": (0xa8764a, 0.85, 0.0, 0.0, 1.0, False),
    "bois-clair": (0xcf9f68, 0.85, 0.0, 0.0, 1.0, False),
    "bois-sombre": (0x6f4a31, 0.85, 0.0, 0.0, 1.0, False),
    "pierre": (0xcbc6bc, 0.9, 0.0, 0.0, 1.0, False),
    "pierre-sombre": (0x9d978d, 0.9, 0.0, 0.0, 1.0, False),
    "enduit": (0xf1eadb, 0.9, 0.0, 0.0, 1.0, False),
    "tuile": (0xc4583f, 0.8, 0.0, 0.0, 1.0, False),
    "ardoise": (0x5d6a78, 0.7, 0.0, 0.0, 1.0, False),
    "peinture-blanche": (0xf5f2ea, 0.6, 0.0, 0.0, 1.0, False),
    "peinture-rouge": (0xd6503a, 0.6, 0.0, 0.0, 1.0, False),
    "peinture-verte": (0x5e9a63, 0.6, 0.0, 0.0, 1.0, False),
    "peinture-bleue": (0x6f9fc8, 0.6, 0.0, 0.0, 1.0, False),
    "fer": (0x4a4744, 0.5, 0.6, 0.0, 1.0, False),
    "verre": (0xdff4f2, 0.08, 0.0, 0.0, 0.32, False),
    "ombre": (0x2a1d14, 1.0, 0.0, 0.0, 1.0, False),
    # Les toiles
    "toile-creme": (0xf5ead3, 0.95, 0.0, 0.0, 1.0, True),
    "toile-rouge": (0xd9533f, 0.95, 0.0, 0.0, 1.0, True),
    "toile-verte": (0x5b9a5d, 0.95, 0.0, 0.0, 1.0, True),
    "toile-orange": (0xec8a37, 0.95, 0.0, 0.0, 1.0, True),
    "toile-bleue": (0x6f9fd0, 0.95, 0.0, 0.0, 1.0, True),
    "toile-jute": (0xc8a676, 0.95, 0.0, 0.0, 1.0, True),
    "bambou": (0xa9b35c, 0.6, 0.0, 0.0, 1.0, False),
    "mousse": (0x7f9a3a, 0.95, 0.0, 0.0, 1.0, False),
    "vapeur": (0xffffff, 1.0, 0.0, 0.0, 0.28, False),
    "jute": (0xcfb383, 0.95, 0.0, 0.0, 1.0, False),
    "pot": (0xc97a4c, 0.9, 0.0, 0.0, 1.0, False),
    # Ce qui brille la nuit
    "lumiere": (0xffc86b, 0.5, 0.0, 2.5, 1.0, False),
    # Le papier d'un lampion : orange, qui luit doucement même le jour
    "lampion": (0xf28a3a, 0.8, 0.0, 0.9, 1.0, False),
}

# Les couleurs de saison : seules les matières qui changent sont listées.
# Le jeu les applique par nom de matière ; le manifeste les recopie.
SAISONS: dict[str, dict[str, int]] = {
    "printemps": {
        "feuillage": 0x8ccc57,
        "feuillage-clair": 0xaedb6c,
        "herbe": 0x96ca5c,
    },
    "automne": {
        "feuillage": 0xe0923a,
        "feuillage-clair": 0xf0b34a,
        "feuillage-sombre": 0xc0602f,
        "herbe": 0xb6b25c,
        "herbe-sombre": 0x9a9a48,
        "brin": 0xc2a857,
        "roseau": 0xb0955a,
        "mousse": 0x9a8a3a,
    },
    "hiver": {
        "feuillage": 0xdfe8ec,
        "feuillage-clair": 0xf2f6f8,
        "feuillage-sombre": 0xc7d3da,
        "sapin": 0x5d8a6a,
        "herbe": 0xe7eef0,
        "herbe-sombre": 0xd2dde2,
        "brin": 0xcbd6c8,
    },
}


def lineaire(hexa: int) -> tuple[float, float, float, float]:
    """sRGB → linéaire : Blender et glTF travaillent en linéaire."""

    def canal(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255
    return (canal(r / 255), canal(g / 255), canal(b / 255), 1.0)


def hexa(valeur: int) -> str:
    return f"#{valeur:06x}"
