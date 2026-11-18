# Vidéos des réalisations

Vidéos promo verticales (Reel Instagram, 1080x1920) faites à partir des photos
publiées sur le site vitrine. Outil : HyperFrames (HeyGen, gratuit, rendu local).
Aucun crédit HeyGen n'est utilisé : accord de Raphaël avant toute dépense.

## Refaire une vidéo pour une autre réalisation

1. Photos : les prendre dans le manifeste public du site
   (`galerie/<propriétaire>/manifest.json`, champ `realisations[].photos[].full`).
2. Relief : `python3 -I videos/depth.py model.onnx <dossier photos> <dossier sortie>`
   calcule une carte de profondeur par photo (modèle gratuit Depth Anything V2
   Small, licence Apache-2.0, à télécharger sur Hugging Face :
   `onnx-community/depth-anything-v2-small`, fichier `onnx/model.onnx`).
3. Copier `allenby-54/`, remplacer `assets/photos` et `assets/depth`, adapter la
   liste `SHOTS` (photo, début, durée, cadrage) et les textes (variables en tête
   de `index.html`).
4. `npx hyperframes check`, puis `npx hyperframes render --quality delivery -o video.mp4`.

La vidéo est muette exprès : la musique s'ajoute dans Instagram au moment de publier.
