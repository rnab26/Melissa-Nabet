"""Cartes de profondeur (Depth Anything V2 Small, Apache-2.0) pour l'effet de relief.
Usage : python3 -I depth.py model.onnx dossier_photos dossier_sortie
Sortie : <nom>.png en niveaux de gris, blanc = proche, même proportions que la photo."""
import sys, os
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

model, src, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
opts = ort.SessionOptions(); opts.intra_op_num_threads = 4
sess = ort.InferenceSession(model, opts, providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])
for name in sorted(os.listdir(src)):
    im = Image.open(os.path.join(src, name)).convert("RGB")
    w, h = im.size
    s = 518 / min(w, h)  # côté court à 518, multiples de 14 exigés par le modèle
    W, H = round(w * s / 14) * 14, round(h * s / 14) * 14
    x = (np.asarray(im.resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - mean) / std
    d = sess.run(None, {inp: x.transpose(2, 0, 1)[None].astype(np.float32)})[0].squeeze()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    d = np.clip((d - lo) / (hi - lo), 0, 1)
    assert d.shape == (H, W) and 0 <= d.min() and d.max() <= 1
    img = Image.fromarray((d * 255).astype(np.uint8)).resize((w // 2, h // 2), Image.BICUBIC)
    img.filter(ImageFilter.GaussianBlur(3)).save(os.path.join(out, os.path.splitext(name)[0] + ".png"))
    print(name, (w, h), "->", (W, H), "ok")
