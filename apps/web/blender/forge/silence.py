"""
Fait taire Blender le temps d'un rendu, d'une cuisson ou d'un export.

Cycles écrit sa progression directement sur le descripteur 1, au niveau C :
rediriger `sys.stdout` n'y suffit pas. Or la sortie standard de la forge est
réservée au rapport `--json` qu'un agent lit — on détourne donc le
descripteur lui-même vers /dev/null, puis on le rétablit.
"""

import contextlib
import os
import sys


@contextlib.contextmanager
def silence(erreurs: bool = False):
    """Détourne la sortie standard (et la sortie d'erreur si `erreurs`)."""
    fds = (1, 2) if erreurs else (1,)
    sys.stdout.flush()
    sys.stderr.flush()
    sauves = [os.dup(fd) for fd in fds]
    nul = os.open(os.devnull, os.O_WRONLY)
    try:
        for fd in fds:
            os.dup2(nul, fd)
        yield
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
        for fd, sauve in zip(fds, sauves):
            os.dup2(sauve, fd)
            os.close(sauve)
        os.close(nul)
