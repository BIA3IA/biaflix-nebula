// Configura l'istanza Jellyfin LOCALE di sviluppo (mai la produzione):
// wizard iniziale, librerie Film/Serie TV sui media sintetici, utenti di test.
// Le credenziali qui sotto valgono solo per il container locale su 127.0.0.1.

const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  throw new Error(`Seed consentito solo su localhost, ricevuto: ${BASE}`);
}

export const DEV_USERS = {
  admin: { name: 'admin', password: 'nebula-dev' },
  curator: { name: 'curatrice', password: 'nebula-dev', collections: true },
  viewer: { name: 'spettatore', password: 'nebula-dev', collections: false },
};

const AUTH = 'MediaBrowser Client="Biaflix Nebula Dev", Device="seed", DeviceId="nebula-seed", Version="0.1.0"';

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: token ? `${AUTH}, Token="${token}"` : AUTH,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function login(user) {
  const r = await call('/Users/AuthenticateByName', { method: 'POST', body: { Username: user.name, Pw: user.password } });
  return { token: r.AccessToken, userId: r.User.Id, user: r.User };
}

async function wizard() {
  const info = await call('/System/Info/Public');
  if (info.StartupWizardCompleted) return;
  await call('/Startup/Configuration', {
    method: 'POST',
    body: { UICulture: 'it-IT', MetadataCountryCode: 'IT', PreferredMetadataLanguage: 'it' },
  });
  await call('/Startup/User');
  await call('/Startup/User', { method: 'POST', body: { Name: DEV_USERS.admin.name, Password: DEV_USERS.admin.password } });
  await call('/Startup/RemoteAccess', { method: 'POST', body: { EnableRemoteAccess: true } });
  await call('/Startup/Complete', { method: 'POST' });
}

async function libraries(token) {
  const existing = await call('/Library/VirtualFolders', { token });
  const wanted = [
    { name: 'Film', type: 'movies', path: '/media/movies' },
    { name: 'Serie TV', type: 'tvshows', path: '/media/shows' },
  ];
  for (const lib of wanted) {
    if (existing.some((f) => f.Name === lib.name)) continue;
    const q = new URLSearchParams({ name: lib.name, collectionType: lib.type, paths: lib.path, refreshLibrary: 'true' });
    await call(`/Library/VirtualFolders?${q}`, {
      method: 'POST',
      token,
      body: { LibraryOptions: { EnableRealtimeMonitor: false, MetadataSavers: [], DisabledLocalMetadataReaders: [] } },
    });
  }
}

async function users(token) {
  const all = await call('/Users', { token });
  for (const u of [DEV_USERS.curator, DEV_USERS.viewer]) {
    let user = all.find((x) => x.Name === u.name);
    if (!user) user = await call('/Users/New', { method: 'POST', token, body: { Name: u.name, Password: u.password } });
    await call(`/Users/${user.Id}/Policy`, {
      method: 'POST',
      token,
      body: { ...user.Policy, EnableCollectionManagement: u.collections, IsAdministrator: false },
    });
  }
}

async function waitForItems(token, userId) {
  for (let i = 0; i < 60; i++) {
    const r = await call(`/Items?userId=${userId}&recursive=true&includeItemTypes=Movie,Series&limit=0`, { token });
    if (r.TotalRecordCount >= 8) return r.TotalRecordCount;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('La scansione della libreria locale non ha prodotto gli item attesi');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await wizard();
  const admin = await login(DEV_USERS.admin);
  await libraries(admin.token);
  await users(admin.token);
  const count = await waitForItems(admin.token, admin.userId);
  console.log(`Seed completato: ${count} film/serie in ${BASE}`);
}
