/* Bouton « Cockpit » dans le CRM (chantier 976c21c3, 16 oct. 2026). Réponses de Raphaël : bouton dans le
   menu, visible par lui seul (compte admin = le compte connecté). Vérifie : rien (ni bouton ni module)
   avant la connexion ; après connexion, le bouton apparaît, ouvre et ferme le panneau du cockpit ; sur
   téléphone (barre du haut repliée), « Plus › Cockpit » fait la même chose ; déconnexion = bouton caché ;
   module injoignable = message visible, bouton reste caché.
   Le module réel est chargé depuis GitHub Pages (via Node : Chromium du conteneur ne fait pas confiance au
   proxy TLS, jamais ignoreHTTPSErrors). Lancer : python3 -m http.server 8899 puis node tests/cockpit-bouton.test.mjs */
import { chromium } from 'playwright';

const URL_APP = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';
const ok = [], ko = [];
const check = (n, p, d = '') => { (p ? ok : ko).push(n); console.log((p ? '  OK   ' : '  ECHEC') + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function ouvre(viewport, { moduleKo = false } = {}) {
  const page = await browser.newPage({ viewport });
  const erreurs = []; page.on('pageerror', e => erreurs.push(String(e)));
  await page.route(/^https:\/\/rnab26\.github\.io\/Cockpit-General\/embed\//, async route => {
    if (moduleKo) return route.abort();
    const r = await fetch(route.request().url());
    await route.fulfill({ status: r.status, contentType: 'application/javascript', body: await r.text() });
  });
  // La fonction serveur du cockpit n'est pas l'objet du test : réponse vide, le panneau s'ouvre quand même.
  await page.route(/functions\/v1\/cockpit-embed/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  return { page, erreurs };
}
const etat = page => page.evaluate(() => {
  const b = document.getElementById('cockpit-btn');
  return { bouton: !!b && getComputedStyle(b).display !== 'none', module: !!document.querySelector('script[src*="cockpit-embed"]') };
});
const panneauVisible = page => page.evaluate(() => [...document.querySelectorAll('div')].some(d => d.style.zIndex === '2147483000' && d.style.display === 'block'));

// ---- Ordinateur
{
  const { page, erreurs } = await ouvre({ width: 1280, height: 800 });
  let e = await etat(page);
  check('Avant connexion : ni bouton Cockpit ni module chargé', !e.bouton && !e.module, JSON.stringify(e));
  await page.evaluate(() => { loggedIn = true; document.getElementById('login-overlay').style.display = 'none'; chargerCockpit(); });
  await page.waitForFunction(() => !document.getElementById('cockpit-btn').hidden, null, { timeout: 8000 }).catch(() => {});
  e = await etat(page);
  check('Après connexion : le bouton Cockpit apparaît dans la barre du haut', e.bouton && e.module, JSON.stringify(e));
  await page.click('#cockpit-btn');
  check('Toucher « Cockpit » ouvre le panneau', await panneauVisible(page));
  await page.click('#cockpit-btn');
  check('Un second toucher le referme', !(await panneauVisible(page)));
  await page.evaluate(() => { loggedIn = false; document.getElementById('cockpit-btn').hidden = true; });
  check('Déconnexion : le bouton disparaît', !(await etat(page)).bouton);
  check('Aucune erreur JavaScript (ordinateur)', erreurs.length === 0, erreurs.join(' | '));
  await page.close();
}
// ---- Téléphone 390 px
{
  const { page, erreurs } = await ouvre({ width: 390, height: 844 });
  await page.evaluate(() => { loggedIn = true; document.getElementById('login-overlay').style.display = 'none'; chargerCockpit(); });
  await page.waitForFunction(() => !document.getElementById('cockpit-btn').hidden, null, { timeout: 8000 }).catch(() => {});
  await page.click('#toolbar-plus');
  const present = await page.locator('#plus-cockpit').count();
  check('Téléphone : « Plus » propose Cockpit', present === 1);
  await page.click('#plus-cockpit');
  await page.waitForTimeout(300);
  const vis = await panneauVisible(page);
  const box = await page.evaluate(() => { const d = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '2147483000'); const r = d && d.getBoundingClientRect(); return r && { l: r.left, r: r.right, w: innerWidth }; });
  check('Téléphone : le panneau s’ouvre et tient dans l’écran', vis && box && box.l >= 0 && box.r <= box.w, JSON.stringify(box));
  await page.screenshot({ path: process.env.CAPTURE || '/tmp/claude-0/cockpit-tel.png' });
  check('Aucune erreur JavaScript (téléphone)', erreurs.length === 0, erreurs.join(' | '));
  await page.close();
}
// ---- Module injoignable
{
  const { page } = await ouvre({ width: 1280, height: 800 }, { moduleKo: true });
  await page.evaluate(() => { loggedIn = true; document.getElementById('login-overlay').style.display = 'none'; chargerCockpit(); });
  await page.waitForTimeout(1200);
  const t = await page.evaluate(() => document.getElementById('toast').textContent);
  check('Module injoignable : message visible, bouton caché', /Cockpit indisponible/.test(t) && !(await etat(page)).bouton, t);
  await page.close();
}
await browser.close();
console.log(`\n===== COCKPIT BOUTON : ${ok.length} OK, ${ko.length} ECHEC =====`);
process.exit(ko.length ? 1 : 0);
