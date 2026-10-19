# Audit plugin e configurazione: Fase 0

**Data:** 19 ottobre 2026
**Metodo:** solo lettura, dalla LAN, tramite gli endpoint **pubblici non autenticati** del server di produzione `http://192.168.1.3:8096`: `index.html` servito, `/Branding/*`, `/JavaScriptInjector/public.js`, `/JellyTweaks/public-config`, `/JellyfinEnhanced/public-config`, `/CustomTabs/Config` e `/api-docs/openapi.json`.
Nessuna scrittura, nessun login, nessuna API key. I campi potenzialmente sensibili (URL Seerr, mapping, immagini) non sono stati riportati.

## Versioni effettive

| Componente                         | Versione rilevata                                                                                  | Fonte                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Jellyfin Server                    | **12.2.0**                                                                                         | `/System/Info/Public`, OpenAPI `x-jellyfin-version` |
| Jellyfin Web                       | 12.2 (bundle `26148176bec435074cdd`), layout **Modern** di default                                 | `index.html`                                        |
| Jellyfin Enhanced                  | **12.12.0.0** (build `639273296920000000`), sorgente al tag `12.12.0.0`, commit `436a558`          | attributo `<script plugin>`                         |
| KefinTweaks                        | **v0.5.1** (risolto da `@latest`), commit `d24379a`                                                | `kefinTweaksRootResolved` nella config              |
| JellyTweaks (plugin)               | 5.0.0.0                                                                                            | `<script plugin="JellyTweaks">`                     |
| JavaScript Injector                | presente (`v=639280033123205442`)                                                                  | `index.html`                                        |
| InPlayerEpisodePreview             | 2.4.0.3                                                                                            | `index.html`                                        |
| Plugin Pages                       | 3.0.2.0                                                                                            | `index.html`                                        |
| CustomTabs                         | presente, **nessuna tab configurata** (`[]`)                                                       | `/CustomTabs/Config`                                |
| File Transformation, Intro Skipper | indicati nella specifica, **non verificabili** senza accesso admin (non iniettano script pubblici) | —                                                   |

> ⚠️ KefinTweaks viene caricato con `@latest` (`ranaldsgift/KefinTweaks@latest`). Un aggiornamento upstream cambia la UI senza preavviso. Consiglio: fissare `@v0.5.1` nello script JS Injector «kefin» e in `kefinTweaksRoot`. È una modifica di produzione e va applicata solo con la tua approvazione.

## Stile attivo oggi

**Custom CSS del server (Dashboard → Generale → Branding)**, copia integrale (non contiene segreti):

```css
/* Main ElegantFin CSS */
@import url('https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css');

/* ElegantFin Media Bar CSS */
@import url('https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-latest-min.css');

/* ElegantFin 12 Companion CSS */
@import url('https://cdn.jsdelivr.net/gh/mihaif7/elegantfin-jf12@main/Theme/ElegantFin-jf12-modern-latest.css');

/* Seerr Recommendations: disabilita titolo fisso */
.je-recommendations-title {
  position: static !important;
  top: auto !important;
  z-index: auto !important;
}

/* Rimuove lo sfondo sovrapposto del titolo */
.je-recommendations-title::before {
  display: none !important;
}
```

**KefinTweaks Skin Manager:** `skinManager: true`, `defaultSkin: "ElegantFin"`, `skins: []`, `themes: []`.

### Conflitto rilevato (da risolvere al cutover)

ElegantFin oggi viene caricato **due volte**: dal Branding CSS (che vale per tutti, sempre) e dalla skin predefinita ElegantFin dello Skin Manager.
KefinTweaks non tocca mai il Branding CSS (verificato in `skinManager.js` v0.5.1). Quindi, finché gli `@import` restano nel Branding, **qualsiasi skin scelta, Nebula compresa, si sovrappone a ElegantFin**. La specifica lo vieta («non sovrapporre ElegantFin e Nebula»).
La procedura in [install.md](install.md) sposta ElegantFin (con gli stessi tre URL) dentro lo Skin Manager, così resta identico per chi lo usa e diventa alternativo a Nebula.

## JS Injector: script pubblici

| Script                 | Contenuto                                                     | Note                                  |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `kefin`                | carica `KefinTweaks@latest/kefinTweaks-plugin.js`             | vedi avviso `@latest`                 |
| `KefinTweaks-Config`   | `window.KefinTweaksConfig` (generato dalla UI di KefinTweaks) | `mdblistApiKey` vuoto; nessun segreto |
| `KefinTweaks-injector` | preload degli asset KefinTweaks v0.5.1                        | autogenerato                          |

Gli script privati (`private.js`) richiedono autenticazione e non sono stati letti.

## KefinTweaks 0.5.1: valori effettivi e raccomandazione Nebula

| Feature                                                                                                                                      | Oggi         | Target Nebula    | Motivazione                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| skinManager                                                                                                                                  | ON           | **ON**           | Nebula si registra come skin; ElegantFin resta selezionabile                                                                      |
| homeScreen (custom sections, spotlight stagionali)                                                                                           | ON           | **ON**           | Nebula aggiunge solo hero + 2 rail, inserite con `order` tra le sezioni Kefin                                                     |
| watchlist                                                                                                                                    | **OFF**      | **OFF**          | fonte canonica della watchlist = `UserData.Likes`, sincronizzata da JE con Seerr; Nebula mostra un'unica rail e un unico pulsante |
| search (Seerr ON)                                                                                                                            | ON           | **ON**           | i risultati Seerr li disegna JE, KefinTweaks solo i filtri: nessuna duplicazione                                                  |
| hamburgerMenu (desktop)                                                                                                                      | ON           | **ON**           | Nebula non aggiunge un drawer: rimane uno solo                                                                                    |
| headerTabs, customMenuLinks (vuoti)                                                                                                          | ON           | ON               | nessun link duplicato                                                                                                             |
| breadcrumbs, playlist, collections, flattenSingleSeasonShows, seriesInfo, versionPreferences, subtitleSearch, removeContinue, infiniteScroll | ON           | ON               | stilizzati via CSS                                                                                                                |
| thumbnailScrubber                                                                                                                            | ON           | **valutare OFF** | spec: opzionale/pesante; decisione tua                                                                                            |
| watchTogether                                                                                                                                | ON           | **valutare OFF** | spec: solo se usato davvero                                                                                                       |
| games, userManager                                                                                                                           | OFF          | OFF              | —                                                                                                                                 |
| itemDetailsCollections                                                                                                                       | ON in config | inattivo su 12   | in 0.5.1 vale solo per Jellyfin 10/11 (`versions:[10,11]`)                                                                        |
| homeScreen.watchlist (sezione)                                                                                                               | OFF          | OFF              | sostituita dalla rail Nebula «La mia watchlist» (stesso slot `order: 60`)                                                         |

## Jellyfin Enhanced 12.12: valori pubblici rilevanti

| Area                                                                         | Valore attuale | Note per Nebula                                                                                                                    |
| ---------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Seerr: risultati in ricerca                                                  | ON             | unico presenter dei risultati Seerr                                                                                                |
| Seerr: watchlist (`AddRequestedMediaToWatchlist`, `SyncJellyseerrWatchlist`) | ON             | la watchlist è `Likes`: Nebula legge e scrive la stessa fonte                                                                      |
| Random button                                                                | ON             | unico pulsante «casuale» (Nebula non ne aggiunge)                                                                                  |
| Calendar (Native Tab + Plugin Pages)                                         | ON             | nessun link Nebula duplicato                                                                                                       |
| Recommendations / Activity (Native Tab)                                      | ON             | stile via `plugin-compat.css`                                                                                                      |
| Pause screen                                                                 | ON             | variabili `--pause-screen-*`, layout invariato                                                                                     |
| Bookmarks                                                                    | OFF            | —                                                                                                                                  |
| Spoiler blur                                                                 | OFF            | nessun conflitto                                                                                                                   |
| Quality tags (top-left), rating tags (bottom-right)                          | ON             | le quick action Nebula stanno in alto a destra; la colonna JE in alto a destra (genere, oggi OFF) si nasconde solo durante l'hover |
| Shortcuts                                                                    | attivi         | `/` apre la ricerca: Nebula non registra scorciatoie globali; i dialog Nebula intercettano i tasti mentre sono aperti              |
| Maintenance mode                                                             | OFF            | non toccare                                                                                                                        |

## Jellyfin 12.2: API raccolte e playlist (verificate su istanza locale identica)

| Operazione          | Endpoint 12.2                                          | Permesso               | Comportamento verificato                                                           |
| ------------------- | ------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| Crea raccolta       | `POST /Collections?name&ids`                           | `CollectionManagement` | film **e serie** insieme ✔                                                         |
| Aggiungi/rimuovi    | `POST/DELETE /Collections/{id}/Items?ids`              | `CollectionManagement` | rimozione non tocca i file ✔                                                       |
| Elimina raccolta    | `DELETE /Items/{id}`                                   | `CanDelete`            | consentito anche al non-admin con `CollectionManagement`                           |
| Descrizione / cover | `POST /Items/{id}`, `POST /Items/{id}/Images/Primary`  | **solo admin**         | 403 per non-admin                                                                  |
| Visibilità raccolte | —                                                      | —                      | **globali**: visibili a tutti gli utenti con accesso ai titoli                     |
| Playlist            | `POST /Playlists` (body JSON), `…/Items`, `…/Move/{i}` | utente                 | personali di default, `IsPublic` opzionale; **una serie viene espansa in episodi** |
| Watchlist           | `POST/DELETE /UserItems/{id}/Rating?likes=true`        | utente                 | distinta da `IsFavorite` ✔                                                         |

Durante le prove è emersa una `IOException` lato server (`collection.xml being used by another process`) con mutazioni ravvicinate sulla stessa raccolta. Nebula quindi serializza le mutazioni per raccolta e rilegge il server dopo ogni scrittura, segnalando gli esiti non confermati.

## Non verificato (richiede accesso amministrativo o al nodo)

- elenco completo dei plugin installati e relative versioni (`/Plugins` è 401 senza login);
- config privata di JE, impostazioni per utente, configurazione Seerr/Sonarr/Radarr;
- Custom CSS **per utente** (Impostazioni → Schermo) di ciascun account;
- stato del mount NFS `/mnt/media` e trigger del task «Clean up collections and playlists». **Va verificato prima di creare raccolte curate**: vedi [rollback.md](rollback.md#raccolte-e-nfs);
- permesso «Gestione raccolte» sugli account non admin reali.
