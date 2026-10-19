// Attende che il Jellyfin locale risponda (max 120s).
const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(`${BASE}/System/Info/Public`)).ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
console.error('Jellyfin locale non raggiungibile');
process.exit(1);
