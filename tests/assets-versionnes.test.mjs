// Garde-fou du découpage de index.html : l'empreinte de assets/crm.css et assets/crm.js doit être à
// jour dans index.html, sinon la détection « nouvelle version disponible » (ETag de index.html) ne voit
// pas un changement qui ne touche que ces fichiers. Correctif : python3 scripts/versionner-assets.py
import { spawnSync } from 'node:child_process';
const r = spawnSync('python3', ['scripts/versionner-assets.py', '--verifier'], { encoding: 'utf8' });
if (r.status === 0) { console.log('  OK    Empreintes de assets/crm.css et assets/crm.js à jour dans index.html'); console.log('\n===== ASSETS VERSIONNÉS : 1 OK, 0 ECHEC ====='); }
else { console.log('  ECHEC ' + (r.stderr || r.stdout).trim()); console.log('\n===== ASSETS VERSIONNÉS : 0 OK, 1 ECHEC ====='); process.exit(1); }
