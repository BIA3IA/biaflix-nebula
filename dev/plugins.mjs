// Installa nel Jellyfin LOCALE di sviluppo gli stessi plugin della produzione Biaflix
// (versioni rilevate nell'audit), per testare Nebula con i DOM reali di KefinTweaks e JE.
// Rifiuta qualsiasi URL che non sia localhost. Dopo l'installazione: `docker restart biaflix-nebula-dev`.
import { DEV_USERS, login } from './seed.mjs';

const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error(`Solo localhost: ${BASE}`);

const REPOS = [
  { Name: 'n00bcodr', Url: 'https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json', Enabled: true },
  { Name: 'IAmParadox27', Url: 'https://www.iamparadox.dev/jellyfin/plugins/manifest.json', Enabled: true },
];

// Stesse versioni della produzione (docs/plugin-audit.md).
const PLUGINS = [
  { name: 'File Transformation', version: '3.0.2.0' },
  { name: 'Plugin Pages', version: '3.0.2.0' },
  { name: 'JavaScript Injector', version: '4.0.0.0' },
  { name: 'Jellyfin Enhanced', version: '12.12.0.0' },
  { name: 'Jellyfin Tweaks', version: '5.0.0.0' },
];

const AUTH = (t) => ({ Authorization: `MediaBrowser Token="${t}"`, 'Content-Type': 'application/json' });

const admin = await login(DEV_USERS.admin);
const h = AUTH(admin.token);

const current = await (await fetch(`${BASE}/Repositories`, { headers: h })).json();
const merged = [...current.filter((r) => !REPOS.some((x) => x.Url === r.Url)), ...REPOS];
let res = await fetch(`${BASE}/Repositories`, { method: 'POST', headers: h, body: JSON.stringify(merged) });
if (!res.ok) throw new Error(`Repositories → ${res.status}`);

const installed = await (await fetch(`${BASE}/Plugins`, { headers: h })).json();
for (const p of PLUGINS) {
  if (installed.some((i) => i.Name === p.name && i.Version === p.version)) {
    console.log(`già installato: ${p.name} ${p.version}`);
    continue;
  }
  res = await fetch(`${BASE}/Packages/Installed/${encodeURIComponent(p.name)}?version=${p.version}`, { method: 'POST', headers: h });
  console.log(`${p.name} ${p.version} → ${res.status}`);
  if (!res.ok) throw new Error(await res.text());
}
console.log('Fatto. Riavvia il container: docker restart biaflix-nebula-dev');
