"""
Le contrôle des interpénétrations de la forge (`scripts/forge.sh test`).

Deux objets d'une même pièce ne se traversent pas : un rocher dans un autre,
un sac enfoncé dans le socle d'un moulin, une citrouille dans sa voisine.
"""

import unittest

from forge.atelier import Empreinte
from forge.controle import interpenetrations


def cercle(nom, genre, x, y, r, bas=0.0, haut=1.0):
    return Empreinte(nom, genre, x, y, r, bas, haut)


def boite(nom, genre, x, y, w, d, angle=0.0, bas=0.0, haut=1.0):
    return Empreinte(nom, genre, x, y, 0.0, bas, haut, w, d, angle)


class TestInterpenetrations(unittest.TestCase):
    def test_deux_rochers_qui_se_traversent(self):
        self.assertTrue(interpenetrations([cercle("a", "rocher", 0, 0, 0.5), cercle("b", "rocher", 0.6, 0, 0.5)]))

    def test_un_contact_n_est_pas_une_traversee(self):
        self.assertFalse(interpenetrations([cercle("a", "rocher", 0, 0, 0.5), cercle("b", "rocher", 0.98, 0, 0.5)]))

    def test_l_un_au_dessus_de_l_autre(self):
        # Un sac posé sur un autre : même place au sol, hauteurs disjointes.
        self.assertFalse(interpenetrations([
            cercle("bas", "objet", 0, 0, 0.2, 0, 0.45),
            cercle("haut", "objet", 0, 0, 0.2, 0.45, 0.9),
        ]))

    def test_une_touffe_peut_tout_froler(self):
        self.assertFalse(interpenetrations([cercle("a", "herbe", 0, 0, 0.3), cercle("b", "buisson", 0.1, 0, 0.5)]))

    def test_une_couronne_ne_gene_pas_un_tronc(self):
        self.assertFalse(interpenetrations([cercle("c", "couronne", 0, 0, 1.5, 1, 4), cercle("t", "tronc", 0.5, 0, 0.3)]))

    def test_une_couronne_gene_ce_qui_monte_jusqu_a_elle(self):
        self.assertTrue(interpenetrations([
            cercle("c", "couronne", 0, 0, 1.5, 1.5, 4),
            cercle("lanterne", "objet", 0.5, 0, 0.2, 0, 2),
        ]))

    def test_cercle_contre_boite_tournee(self):
        etal = boite("etal", "objet", 0, 0, 2.0, 1.0, angle=0.0, haut=2.3)
        self.assertTrue(interpenetrations([etal, cercle("sac", "objet", 1.1, 0, 0.2)]))
        self.assertFalse(interpenetrations([etal, cercle("sac", "objet", 1.3, 0, 0.2)]))

    def test_deux_boites_tournees(self):
        a = boite("a", "objet", 0, 0, 2.0, 0.4, angle=0.0)
        b = boite("b", "objet", 0, 0.5, 2.0, 0.4, angle=0.0)
        self.assertFalse(interpenetrations([a, b]))
        c = boite("c", "objet", 0, 0.3, 2.0, 0.4, angle=0.6)
        self.assertTrue(interpenetrations([a, c]))


if __name__ == "__main__":
    unittest.main()
