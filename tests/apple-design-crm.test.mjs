/* Finitions « Apple Design » du CRM (21 nov. 2026, chantier 2e5e85c9) : zones de toucher de 44 px,
   fenêtre en « feuille » sur téléphone, mouvement réduit respecté, retour visuel au toucher.
     node tests/apple-design-crm.test.mjs
*/
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://crm.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const ko = [];
const check = (n, p, d = '') => { if (!p) ko.push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function ouvrir(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.route(BASE + '**', r => {
    const f = join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) });
  });
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof newDevis === 'function' && typeof library === 'object');
  await page.evaluate(() => { document.querySelectorAll('#login-overlay').forEach(e => e.style.display = 'none'); store.set = async () => {}; });
  return { page, ctx };
}

/* 1. Téléphone tactile : cibles >= 44 px, barre du bas >= 49 px, fenêtre = feuille en bas */
{
  const { page, ctx } = await ouvrir({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.evaluate(() => showView('devis'));
  const r = await page.evaluate(() => {
    const trop = [];
    document.querySelectorAll('.btn,.mini,.vnav,.seg-btn,.acc-head,.view-switch button,select').forEach(e => {
      const b = e.getBoundingClientRect(); if (b.width && b.height && b.height < 43.5) trop.push((e.className || e.tagName) + ':' + b.height);
    });
    const nav = [...document.querySelectorAll('.navbas button')].map(b => b.getBoundingClientRect().height);
    openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Test</h3><p class="msub">x</p>');
    return { trop, nav, x: document.querySelector('.modal-x').getBoundingClientRect().height };
  });
  check('téléphone : aucune zone de toucher sous 44 px', r.trop.length === 0, r.trop.slice(0, 5).join(', '));
  check('téléphone : barre du bas >= 49 px', r.nav.length > 0 && r.nav.every(h => h >= 48.5), r.nav.join(','));
  check('téléphone : bouton fermer de la fenêtre >= 44 px', r.x >= 43.5, String(r.x));
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const b = document.getElementById('modal').getBoundingClientRect(); return { bas: b.bottom, h: innerHeight, large: b.width, rayon: getComputedStyle(document.getElementById('modal')).borderTopLeftRadius }; });
  check('téléphone : la fenêtre est ancrée en bas, pleine largeur', Math.abs(m.bas - m.h) < 2 && m.large >= 389, JSON.stringify(m));
  /* retour au toucher : l'état actif est défini sur les boutons */
  const act = readFileSync(join(ROOT, 'assets/crm.css'), 'utf8');
  check('retour visuel au toucher (:active) sur boutons et barre du bas', /\.btn:active/.test(act) && /\.navbas button:active/.test(act));
  await ctx.close();
}

/* 2. Mouvement réduit : plus d'animation d'entrée */
{
  const { page, ctx } = await ouvrir({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const d = await page.evaluate(() => { openModal('<h3>x</h3>'); return parseFloat(getComputedStyle(document.getElementById('modal')).animationDuration); });
  check('mouvement réduit : animation de la fenêtre quasi nulle', d < 0.01, String(d));
  await ctx.close();
}
{
  const { page, ctx } = await ouvrir({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const d = await page.evaluate(() => { openModal('<h3>x</h3>'); return parseFloat(getComputedStyle(document.getElementById('modal')).animationDuration); });
  check('mouvement normal : la fenêtre s\'anime (0,1 à 0,5 s)', d > 0.1 && d < 0.5, String(d));
  await ctx.close();
}

/* 3. Tablette : bureau inchangé (fenêtre centrée, pas en feuille) */
{
  const { page, ctx } = await ouvrir({ viewport: { width: 1250, height: 900 }, hasTouch: true });
  const m = await page.evaluate(() => { openModal('<h3>x</h3>'); const b = document.getElementById('modal').getBoundingClientRect(); return { top: b.top, w: b.width }; });
  check('tablette : fenêtre en haut, largeur plafonnée (pas de feuille)', m.top < 100 && m.w <= 561, JSON.stringify(m));
  await ctx.close();
}

await browser.close();
console.log(ko.length ? `\n${ko.length} ÉCHEC(S)` : '\nTout est OK');
process.exit(ko.length ? 1 : 0);
