// Replica nel Jellyfin LOCALE gli script JS Injector della produzione (KefinTweaks + config + snippet Nebula),
// per testare Nebula nel DOM reale di KefinTweaks 0.5.1.
// - Legge la produzione SOLO in lettura dall'endpoint pubblico /JavaScriptInjector/public.js (nessun login).
// - Salva la copia in dev/.data/prod-public.js (ignorata da git) e la riusa offline.
// - Scrive soltanto sull'istanza localhost.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEV_USERS, login } from './seed.mjs';

const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error(`Solo localhost: ${BASE}`);
const PROD = process.env.BIAFLIX_PROD_URL ?? 'http://192.168.1.3:8096';
const CACHE = new URL('./.data/prod-public.js', import.meta.url);
const JS_INJECTOR = 'f5a34f7b2e8a4e6aa7223a216a81b374';

let source;
if (existsSync(CACHE) && !process.argv.includes('--refresh')) {
  source = readFileSync(CACHE, 'utf8');
} else {
  const res = await fetch(`${PROD}/JavaScriptInjector/public.js`);
  if (!res.ok) throw new Error(`Lettura produzione fallita: ${res.status}`);
  source = await res.text();
  writeFileSync(CACHE, source);
}

/** Estrae il corpo degli script dal bundle pubblico (wrapper try/catch generato da JS Injector). */
function extract(name) {
  const marker = `/* User Script: ${name} */`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Script mancante: ${name}`);
  const next = source.indexOf('/* User Script:', start + marker.length);
  const chunk = source.slice(start + marker.length, next < 0 ? undefined : next);
  const body = chunk.replace(/^\s*\(function\(\) \{ try \{\n?/, '').replace(/\n?\} catch \(e\) \{ console\.error\('Error in Injected JavaScript[\s\S]*$/, '');
  return body.trim();
}

const kefin = extract('kefin').replaceAll('KefinTweaks@latest', 'KefinTweaks@v0.5.1');
const config = extract('KefinTweaks-Config')
  .replaceAll('KefinTweaks@latest', 'KefinTweaks@v0.5.1')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/BIA3IA\/biaflix-nebula@v[\d.]+\/dist\/nebula\.css/g, `${BASE}/__nebula/nebula.css`);
const injector = extract('KefinTweaks-injector');
const nebula = readFileSync(new URL('../dist/js-injector-snippet.js', import.meta.url), 'utf8').replace(
  /https:\/\/cdn\.jsdelivr\.net\/gh\/BIA3IA\/biaflix-nebula@v[\d.]+\/dist\/nebula\.js/,
  `${BASE}/__nebula/nebula.js`,
);

const admin = await login(DEV_USERS.admin);
const headers = { Authorization: `MediaBrowser Token="${admin.token}"`, 'Content-Type': 'application/json' };
const url = `${BASE}/Plugins/${JS_INJECTOR}/Configuration`;
const cfg = await (await fetch(url, { headers })).json();
cfg.CustomJavaScripts = [
  { Name: 'kefin', Script: kefin, Enabled: true, RequiresAuthentication: false },
  { Name: 'KefinTweaks-Config', Script: config, Enabled: true, RequiresAuthentication: false },
  { Name: 'KefinTweaks-injector', Script: injector, Enabled: true, RequiresAuthentication: false },
  { Name: 'BiaFlix Nebula', Script: nebula, Enabled: true, RequiresAuthentication: false },
];
const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(cfg) });
if (!res.ok) throw new Error(`Salvataggio config JS Injector locale: ${res.status}`);
console.log(`JS Injector locale configurato con KefinTweaks v0.5.1 (skin Nebula → ${BASE}/__nebula/nebula.css)`);

// Jellyfin Enhanced: replica «Use Icons» della produzione (lettura dalla config pubblica), per riprodurre
// fedelmente i testi JE (con icone spente JE 12.12 lascia i token {{icon:…}}).
try {
  const prodJe = await (await fetch(`${PROD}/JellyfinEnhanced/public-config`)).json();
  const jeUrl = `${BASE}/Plugins/f69e946a4b3c4e9a8f0a8d7c1b2c4d9b/Configuration`;
  const jeCfg = await (await fetch(jeUrl, { headers })).json();
  jeCfg.UseIcons = prodJe.UseIcons;
  const r = await fetch(jeUrl, { method: 'POST', headers, body: JSON.stringify(jeCfg) });
  console.log(`Jellyfin Enhanced locale: UseIcons=${prodJe.UseIcons} (${r.status})`);
} catch (err) {
  console.warn('Config JE di produzione non raggiungibile, lasciata quella locale:', err.message);
}
