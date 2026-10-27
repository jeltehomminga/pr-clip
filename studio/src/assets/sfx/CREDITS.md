# Sound credits

The UI sounds were rendered with earshot 0.4.0 (MIT, © 2026 Leon Lin, github.com/Leonxlnx/earshot) from its "fit" bank. `kit.json` is the recipe and `kit.lock.json` pins every take: seed, onset, peak, level and sha1.

The bank's source recordings are CC0 1.0, from Freesound:

| Role | Sound | Source |
|---|---|---|
| tick | domino | Macif, freesound.org/s/329098 |
| whoosh.short | bamboo swish | Kinoton, freesound.org/s/427979 |
| snap | switch flip | IanStarGem, freesound.org/s/278205 |

Renders never need earshot. You only need it to cut a new kit: clone earshot, install it into a venv, then run `earshot kit render src/assets/sfx/kit.json --out src/assets/sfx`. Touch the wav files afterwards, because the bundle cache goes by modification time.
