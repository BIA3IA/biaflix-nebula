/**
 * Nessuno screensaver di Jellyfin (backdrop/logo dopo qualche minuto di inattività), per scelta della
 * proprietaria. jellyfin-web 12.2 legge la preferenza `<userId>-screensaver` (appSettings, localStorage)
 * in screensavermanager.js: con un valore che non corrisponde a nessun plugin, nessuno screensaver parte.
 * È la stessa chiave che scrive JellyTweaks con «Force Screensaver». Flag: `disableScreensaver`.
 */
export const SCREENSAVER_OFF = 'none';

export function screensaverKey(userId: string): string {
  return `${userId}-screensaver`;
}

/** Imposta lo screensaver su «nessuno» per l'utente corrente; restituisce true se ha cambiato qualcosa. */
export function disableScreensaver(userId: string, storage: Storage = window.localStorage): boolean {
  try {
    const key = screensaverKey(userId);
    if (storage.getItem(key) === SCREENSAVER_OFF) return false;
    storage.setItem(key, SCREENSAVER_OFF);
    return true;
  } catch {
    return false; // storage non disponibile: nessun effetto
  }
}
