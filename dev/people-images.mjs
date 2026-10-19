// Attende la scansione arricchita e carica ritratti sintetici per METÀ del cast (localhost soltanto):
// l'altra metà resta senza foto per testare i placeholder della sezione Cast.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEV_USERS, login } from './seed.mjs';

const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error(`Solo localhost: ${BASE}`);
const admin = await login(DEV_USERS.admin);
const H = { Authorization: `MediaBrowser Token="${admin.token}"` };
const get = async (p) => (await fetch(BASE + p, { headers: H })).json();

let series;
for (let i = 0; i < 90; i++) {
  const r = await get(`/Items?userId=${admin.userId}&recursive=true&includeItemTypes=Series&searchTerm=Nebula&fields=People,ChildCount`);
  series = r.Items[0];
  const seasons = series ? (await get(`/Shows/${series.Id}/Seasons?userId=${admin.userId}`)).Items.length : 0;
  if (series?.People?.length >= 10 && seasons >= 2) break;
  await new Promise((r) => setTimeout(r, 1000));
}
if (!series?.People?.length) throw new Error('Scansione non completata: cast assente');

const dir = mkdtempSync(join(tmpdir(), 'nebula-people-'));
const hues = [0, 40, 80, 120, 160, 200];
let done = 0;
for (const [i, person] of series.People.filter((p) => p.Type === 'Actor').entries()) {
  if (i % 2 === 1 || person.PrimaryImageTag) continue; // un attore su due resta senza foto
  const file = join(dir, `${i}.jpg`);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `gradients=s=400x600:c0=0x1a1030:c1=0x476dff:d=1`,
    '-vf',
    `hue=h=${hues[i % hues.length]},drawtext=text='${person.Name.split(' ')
      .map((w) => w[0])
      .join('')}':fontcolor=white:fontsize=150:x=(w-text_w)/2:y=(h-text_h)/2`,
    '-frames:v',
    '1',
    file,
  ]);
  const res = await fetch(`${BASE}/Items/${person.Id}/Images/Primary`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'image/jpeg' },
    body: readFileSync(file).toString('base64'),
  });
  if (res.ok) done++;
}
console.log(`Serie "${series.Name}": ${series.People.length} persone, ritratti caricati: ${done}`);
