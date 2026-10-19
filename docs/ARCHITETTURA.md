# Come funziona Biaflix Nebula — il flusso completo

Questo documento spiega **cosa succede, in che ordine e perché**, dal momento in cui scrivi codice in
`src/` fino a quando un utente vede la home di Jellyfin con Nebula. È pensato per essere letto dall'inizio
alla fine la prima volta, e poi usato come riferimento.

> Nebula è **codice nostro** (licenza MIT, logo escluso). Non è un fork di un altro tema: si appoggia a
> plugin di terzi (KefinTweaks, JS Injector, Jellyfin Enhanced) solo come _meccanismi di caricamento_ e
> per convivere con le loro funzioni.

---

## Indice

1. [L'idea in tre righe](#1-lidea-in-tre-righe)
2. [I pezzi in gioco](#2-i-pezzi-in-gioco)
3. [Dal codice al server: build e pubblicazione](#3-dal-codice-al-server-build-e-pubblicazione)
4. [Cosa succede quando un utente apre Jellyfin](#4-cosa-succede-quando-un-utente-apre-jellyfin)
5. [Il CSS: come cambia l'aspetto](#5-il-css-come-cambia-laspetto)
6. [Il JS: avvio passo per passo (`main.ts`)](#6-il-js-avvio-passo-per-passo-maints)
7. [Il ciclo di vita delle pagine (`lifecycle.ts`)](#7-il-ciclo-di-vita-delle-pagine-lifecyclets)
8. [Le feature, una per una](#8-le-feature-una-per-una)
9. [Come Nebula convive con Jellyfin e i plugin](#9-come-nebula-convive-con-jellyfin-e-i-plugin)
10. [Il flusso dei dati: API, servizi, eventi](#10-il-flusso-dei-dati-api-servizi-eventi)
11. [Tre esempi seguiti dall'inizio alla fine](#11-tre-esempi-seguiti-dallinizio-alla-fine)
12. [Correttivi di compatibilità (`compat/`)](#12-correttivi-di-compatibilità-compat)
13. [Mappa dei file](#13-mappa-dei-file)
14. [Ambiente di sviluppo e test](#14-ambiente-di-sviluppo-e-test)
15. [Rilascio, aggiornamento, spegnimento e rollback](#15-rilascio-aggiornamento-spegnimento-e-rollback)
16. [Debug: come capire cosa sta succedendo](#16-debug-come-capire-cosa-sta-succedendo)
17. [Domande frequenti sul «perché»](#17-domande-frequenti-sul-perché)

---

## 1. L'idea in tre righe

1. **Un file CSS** (`nebula.css`) cambia l'aspetto di Jellyfin Web: colori, vetro, navbar, card, pagine.
2. **Un file JS** (`nebula.js`) aggiunge ciò che il CSS da solo non può fare: hero della home, raccolte
   miste, watchlist, pagina dettagli ricomposta, select/tooltip glass, barra mobile.
3. **Nessuno dei due modifica il server**: vengono scaricati dal browser di ogni utente. I dati
   (raccolte, watchlist) vivono nel database di Jellyfin tramite le sue API ufficiali.

Se togli i due file, Jellyfin torna esattamente com'era.

---

## 2. I pezzi in gioco

```
┌──────────────────────────── Browser dell'utente ────────────────────────────┐
│                                                                             │
│  Jellyfin Web 12.2 (la SPA ufficiale: React/MUI + vecchie view "legacy")    │
│     │                                                                       │
│     ├── KefinTweaks 0.5.1 ── Skin Manager ──► <link href=".../nebula.css">  │
│     │                                                                       │
│     ├── JS Injector ── script "Biaflix Nebula" ──► <script src=".../nebula.js">
│     │                                                                       │
│     ├── Jellyfin Enhanced (JE) 12.12 ── Seerr, pulsanti extra, toast…       │
│     │                                                                       │
│     └── nebula.js  ──── legge/scrive via API ───┐                           │
│                                                 │                           │
└─────────────────────────────────────────────────┼───────────────────────────┘
                                                  ▼
                                   Server Jellyfin (database: raccolte,
                                   playlist, Likes = watchlist, ecc.)

             nebula.css / nebula.js / assets  ◄── scaricati da jsDelivr
                                                  (copia CDN del repo GitHub,
                                                   con tag di versione fisso)
```

| Pezzo                          | Di chi è    | Ruolo per Nebula                                                                                               |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------- |
| **Jellyfin Web 12.2**          | Jellyfin    | L'interfaccia che Nebula "veste". Resta la padrona di dati, routing, player, azioni.                           |
| **KefinTweaks** (Skin Manager) | ranaldsgift | Carica il CSS della skin scelta. Nebula è registrata come skin «Biaflix Nebula».                               |
| **JS Injector**                | plugin      | Inietta in ogni pagina uno snippet JS pubblico. Lo snippet carica `nebula.js`.                                 |
| **Jellyfin Enhanced**          | plugin      | Aggiunge funzioni (Seerr, ecc.). Nebula ne adatta lo stile e corregge due suoi difetti.                        |
| **GitHub + jsDelivr**          | hosting     | GitHub conserva i file; jsDelivr li serve come CDN. Si usa **sempre un tag fisso** (`@v0.2.0`), mai `@latest`. |
| **`nebula.css`**               | noi         | Tutto l'aspetto.                                                                                               |
| **`nebula.js`**                | noi         | Tutto il comportamento aggiunto.                                                                               |

---

## 3. Dal codice al server: build e pubblicazione

### 3.1 Sorgenti → `dist/`

Il comando `pnpm build` esegue [tools/build.mjs](../tools/build.mjs), che produce:

| Sorgente                                        | Strumento          | Risultato in `dist/`          | Note                                                                                                                                         |
| ----------------------------------------------- | ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/index.css` (+ i suoi `@import`)     | lightningcss       | `nebula.css`                  | Un solo file minificato; prefissi per Firefox ≥115, Chrome ≥109, Safari ≥16.                                                                 |
| `src/scripts/main.ts` (+ tutto ciò che importa) | esbuild            | `nebula.js` + `nebula.js.map` | Un solo file IIFE minificato (si esegue da sé, niente moduli). La versione da `package.json` viene scritta dentro come `__NEBULA_VERSION__`. |
| `src/scripts/injector-snippet.js`               | sostituzione testo | `js-injector-snippet.js`      | Lo snippet da incollare in JS Injector, con l'URL già versionato.                                                                            |
| `src/assets/*.png`                              | copia              | `assets/`                     | Logo. Il CSS lo referenzia con URL **relativo**, quindi `assets/` deve stare accanto al CSS.                                                 |

`dist/` è **versionata in git** (c'è `!dist/` nel `.gitignore`) proprio perché jsDelivr serve i file
direttamente dal repository.

`pnpm check` = typecheck + lint CSS + test unitari + build: è la verifica minima prima di pubblicare.

### 3.2 `dist/` → URL pubblici

1. Commit e push del branch, poi un **tag** (es. `v0.2.0`) su GitHub.
2. jsDelivr espone automaticamente:
   - `https://cdn.jsdelivr.net/gh/BIA3IA/biaflix-nebula@v0.2.0/dist/nebula.css`
   - `https://cdn.jsdelivr.net/gh/BIA3IA/biaflix-nebula@v0.2.0/dist/nebula.js`
3. Il tag è immutabile: tutti gli utenti ricevono esattamente gli stessi byte, e tornare indietro vuol
   dire solo rimettere il tag precedente negli URL.

### 3.3 URL → configurazione di Jellyfin (fatto una volta per versione)

| Dove                                                         | Cosa ci va                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Dashboard → KefinTweaks → Skin Manager → _Skins JSON_        | La voce `"Biaflix Nebula"` con l'URL di `nebula.css`                                      |
| Dashboard → JS Injector → script «Biaflix Nebula» (pubblico) | Il contenuto di `dist/js-injector-snippet.js` (contiene l'URL di `nebula.js` e la config) |

Dettagli operativi: [install.md](install.md). Questi due URL sono **l'unico punto da aggiornare** a ogni
nuova versione.

---

## 4. Cosa succede quando un utente apre Jellyfin

Questa è la sequenza reale, nell'ordine in cui avviene nel browser:

```
 1. Il browser carica Jellyfin Web (index.html + bundle ufficiali).
 2. JS Injector inserisce i suoi script pubblici, tra cui lo snippet "Biaflix Nebula".
 3. Lo snippet:
      a. se Nebula è già caricata → esce (guardia anti-doppio);
      b. definisce window.BiaflixNebulaConfig = { enabled, activation:'skin', … };
      c. aggiunge <script id="biaflix-nebula-js" src="…/nebula.js" defer>.
 4. KefinTweaks parte e, tramite lo Skin Manager, legge la skin scelta per QUESTO browser
    (localStorage `kefinTweaks_selectedSkin`, o la default impostata dall'admin):
      → se è «Biaflix Nebula» inserisce in <head>:
        <link data-kefin-skin="true" data-skin="Biaflix Nebula" href="…/nebula.css">
      → il CSS si applica subito: l'aspetto cambia.
 5. nebula.js viene eseguito (boot):
      a. legge la config, imposta la lingua;
      b. osserva <head>: «c'è il <link> della skin Nebula?»
         - no  → resta dormiente (nessun effetto, nessuna chiamata API);
         - sì  → start().
 6. start():
      a. attende che l'utente sia loggato (window.ApiClient ha token e userId);
      b. chiama GET /Users/Me → sa chi è l'utente e che permessi ha;
      c. crea il "contesto" (API client + servizi raccolte/playlist/watchlist + flag);
      d. installa le funzioni globali (classi su <html>, tooltip, select glass, azioni card…);
      e. avvia il Lifecycle, che monta le feature giuste per la pagina corrente.
 7. L'utente naviga (es. da Home a un film): Jellyfin cambia l'hash dell'URL e mostra una nuova view.
      → il Lifecycle smonta le feature della pagina precedente e monta quelle della nuova.
```

Due conseguenze importanti:

- **CSS e JS sono indipendenti.** Il CSS lo carica KefinTweaks, il JS lo carica JS Injector. Il JS però si
  attiva _solo se vede il CSS della skin_ (passo 5b). Così un utente che sceglie un'altra skin non riceve
  né l'aspetto né le funzioni di Nebula, e non resta mai "mezza Nebula".
- **Il cambio skin è dal vivo.** Se l'utente cambia skin da KefinTweaks, il `<link>` sparisce/compare e
  `watchSkin` lo nota subito: Nebula si spegne o si accende senza ricaricare.

---

## 5. Il CSS: come cambia l'aspetto

### 5.1 Ordine dei file (la cascata)

[src/styles/index.css](../src/styles/index.css) importa i fogli in un ordine **deliberato**: quelli dopo
vincono su quelli prima a parità di specificità.

| Ordine | File                                | Cosa contiene                                                                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1      | `tokens.css`                        | Le variabili `--nebula-*`: colori, raggi, ombre, vetro, spaziature. **Tutto il resto le usa.**                           |
| 2      | `base.css`                          | Firma `--biaflix-nebula: 1`, sfondo, tipografia, focus, e la mappatura sulla palette MUI di Jellyfin (`--jf-palette-*`). |
| 3      | `navbar.css`                        | Barra superiore fluttuante, logo, link watchlist, toolbar delle librerie.                                                |
| 4      | `components.css`                    | Pulsanti, chip, dialog, toast, tooltip: i "mattoni" Nebula.                                                              |
| 5      | `controls.css`                      | Select glass, checkbox/toggle/radio di Jellyfin e MUI, menu.                                                             |
| 6–9    | `hero`, `rails`, `cards`, `details` | Home (hero, rail), card, pagina dettagli.                                                                                |
| 10–11  | `collections`, `watchlist`          | Hub raccolte, pagina watchlist.                                                                                          |
| 12–13  | `search`, `player`                  | Ricerca, player.                                                                                                         |
| 14     | `plugin-compat.css`                 | Adattamenti a KefinTweaks e JE (e cose dei plugin che nascondiamo: breadcrumb, effetti stagionali, selettore tema…).     |
| 15–16  | `calendar`, `activity`              | Pagine specifiche.                                                                                                       |
| 17–18  | `responsive`, `mobile`              | Regole per larghezze ridotte: vengono dopo per poter sovrascrivere.                                                      |
| 19     | `reduced-motion.css`                | Ultimo: se l'utente chiede meno animazioni, vince su tutto.                                                              |

### 5.2 Due "livelli" di CSS

1. **Regole sempre attive quando la skin è caricata**: palette, sfondo, card, navbar… Non dipendono dal JS.
   Se `nebula.js` non si caricasse, avresti comunque un Jellyfin con l'aspetto Nebula (senza le funzioni extra).
2. **Regole che dipendono da classi messe dal JS**:
   - `html.nebula-active` — il JS è partito;
   - `html.nebula-layout-modern` / `nebula-layout-legacy` — tipo di layout;
   - `html[data-nebula-route="details"]` — pagina corrente;
   - `.nebula-detail`, `.nebula-has-hero`, `.nebula-watchlist-active`… — messe sulla pagina da una feature.

   Esempio: le sezioni native che la pagina dettagli Nebula sostituisce vengono **nascoste via CSS solo se la
   pagina ha `.nebula-detail`**. Se il JS non gira, quella classe non c'è e le sezioni native restano visibili.
   È il meccanismo che rende tutto "reversibile per costruzione".

### 5.3 Cosa il CSS non tocca

La **dashboard di amministrazione** (`body.dashboardDocument`) è esclusa: resta col tema standard di
Jellyfin, così le pagine di configurazione non possono rompersi per colpa della skin.

---

## 6. Il JS: avvio passo per passo (`main.ts`)

File: [src/scripts/main.ts](../src/scripts/main.ts). Si legge dal basso: l'ultima riga è `boot();`.

### 6.1 `boot()` — eseguito una volta sola

```
boot()
 ├─ se window.BiaflixNebula esiste già → return          (snippet iniettato due volte, SPA…)
 ├─ flags = resolveFlags()                               (flags.ts)
 ├─ setLocale(flags.locale)                              (i18n.ts: it/en)
 ├─ window.BiaflixNebula = { version, flags, state, disable(), enable() }
 └─ activate()  (subito, o a DOMContentLoaded)
```

**`resolveFlags()`** ([flags.ts](../src/scripts/flags.ts)) parte da `DEFAULT_FLAGS` e sovrascrive solo i
valori presenti in `window.BiaflixNebulaConfig` **con lo stesso tipo** (un valore sbagliato viene ignorato,
non rompe nulla). Poi, se in questo browser c'è `localStorage['biaflixNebula:disabled'] = '1'`,
forza `enabled = false` (è l'interruttore personale, vedi §15).

Flag principali:

| Flag                                                                 | Default                          | Effetto                                                             |
| -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `enabled`                                                            | `true`                           | Interruttore generale.                                              |
| `activation`                                                         | `'skin'`                         | `'skin'` = solo con la skin Nebula; `'always'` = sempre (sviluppo). |
| `skinName`                                                           | `'Biaflix Nebula'`               | Nome da cercare nel `<link data-skin>`.                             |
| `hero`, `heroAutoplay`, `heroCollectionName`                         | `true`, `false`, `'In evidenza'` | Hero della home.                                                    |
| `homeCollectionsRail`, `homeWatchlistRail`                           | `true`                           | Rail in home.                                                       |
| `cardActions`, `detailActions`, `collectionsHub`, `collectionManage` | `true`                           | Singole funzioni.                                                   |
| `disableScreensaver`                                                 | `true`                           | Spegne lo screensaver di Jellyfin.                                  |
| `debug`                                                              | `false`                          | Log dettagliati in console.                                         |

### 6.2 `activate()` — decide se partire

```
activate()
 ├─ se !flags.enabled → niente
 ├─ se activation === 'always' → start()
 └─ altrimenti watchSkin('Biaflix Nebula', active => active ? start() : stop())
```

**`watchSkin`** ([skin-detect.ts](../src/scripts/skin-detect.ts)): un `MutationObserver` su `<head>` (solo
l'attributo `data-skin` e l'aggiunta/rimozione di figli) e sui figli diretti di `<body>`. Ogni volta controlla
se esiste `link[data-kefin-skin="true"][data-skin="Biaflix Nebula"]` e chiama la callback solo quando lo
stato _cambia_. Non osserva mai l'intero documento (sarebbe costoso).

### 6.3 `start()` — accensione vera e propria

```
start()
 ├─ se già 'starting' o 'running' → return
 ├─ gen = ++generation                       ← "biglietto" di questo avvio (vedi sotto)
 ├─ session = await waitForSession()         ← env.ts: legge window.ApiClient con backoff (fino a 2 min)
 ├─ api = new JellyfinApi(session)
 ├─ user = await api.getCurrentUser()        ← GET /Users/Me
 ├─ se gen è cambiato nel frattempo → return (qualcuno ha chiamato stop() durante l'attesa)
 ├─ ctx = { api, flags, user, serverId, collections, playlists, watchlist, log }
 ├─ lifecycle = new Lifecycle([routeMarker, hero, homeRails, details, collectionsHub, watchlistPage])
 ├─ cleanups = [                              ← funzioni GLOBALI, attive su tutte le pagine
 │     applyShell(),             classi nebula-active / nebula-layout-* su <html>
 │     installWatchlistSync(),   sincronizza tutti i pulsanti watchlist
 │     installNativeCardActions(ctx), pulsanti rapidi sulle card native (hover)
 │     installGlassSelect(),     popup glass per le <select>
 │     installTooltips(),        tooltip glass al posto dei title di sistema
 │     installJeIconTokenFix(),  correttivo JE
 │   ]
 ├─ lifecycle.start()
 ├─ se disableScreensaver → disableScreensaver(user.Id)
 ├─ se layout Modern → installNavbarExtras(ctx), installDrawerExtras()
 ├─ ascolta 'viewshow': se utente/token cambiano (logout, cambio utente) → stop() + start()
 └─ state = 'running'
```

Se qualcosa fallisce (rete giù, sessione scaduta) lo stato torna `idle` e Nebula **riprova al prossimo
cambio pagina**: Jellyfin intanto funziona normalmente.

**Perché la "generation".** `start()` è asincrona: tra l'attesa della sessione e la risposta di
`/Users/Me` l'utente potrebbe aver cambiato skin (→ `stop()`). Ogni `stop()` incrementa `generation`;
quando `start()` si risveglia confronta il suo biglietto `gen` con quello attuale e, se diverso, si
ritira senza montare nulla.

### 6.4 `stop()` — spegnimento pulito

`stop()` esegue la funzione `teardown` preparata da `start()`:

1. rimuove il listener `viewshow`;
2. `lifecycle.stop()` → smonta tutte le feature della pagina corrente;
3. esegue tutti i `cleanups` globali (in pratica: ogni `install…` restituisce la propria funzione di disinstallazione);
4. chiude dialog e toast, rimuove ogni elemento `.nebula-root` rimasto.

Regola che vale per tutto il codice: **ogni cosa che si installa restituisce una funzione che la
disinstalla.** È ciò che rende possibile accendere/spegnere Nebula al volo.

---

## 7. Il ciclo di vita delle pagine (`lifecycle.ts`)

Jellyfin è una SPA: cambiando pagina non si ricarica nulla, cambia solo l'hash (`#/home`, `#/details?id=…`)
e una view viene mostrata al posto di un'altra. Nebula deve quindi sapere **quando** la pagina cambia e
**cosa** montare.

### 7.1 Cos'è una Feature

```ts
interface Feature {
  name: string;
  routes: string[]; // es. ['home'], ['details'], ['boxsets','playlists'], ['*']
  mount(ctx: RouteContext): void | cleanup | Promise<void | cleanup>;
}
// RouteContext = { path, params, page (elemento .page visibile), signal (AbortSignal) }
```

### 7.2 Come gira

```
eventi:  'viewshow' (Jellyfin mostra una view)   'hashchange' (l'URL cambia)
             │                                        │
             └──────────────► schedule() ◄────────────┘
                                 │  fonde le richieste dello stesso frame
                                 ▼
                      requestAnimationFrame → apply()
                                 │
              route = currentRoute()          (env.ts: path + query dell'hash)
              page  = pagina indicata da viewshow, oppure activePage()
              key   = path?query#page.id
                                 │
              se la key è uguale all'ultima e nessuno ha chiesto "force" → stop qui
                                 │
              unmountAll():  per ogni feature montata → controller.abort() + cleanup()
                                 │
              per ogni feature la cui routes contiene path (o '*'):
                    nuovo AbortController
                    cleanup = await feature.mount({ path, params, page, signal })
                    se nel frattempo il signal è stato abortito → esegue subito cleanup
```

Punti chiave:

- **Fusione degli eventi.** `hashchange` e `viewshow` arrivano spesso nello stesso frame. Invece di
  scartare il secondo, il Lifecycle li fonde: vince l'ultima pagina nota, e basta che uno dei due chieda
  `force` perché il rimontaggio avvenga. Senza questo, a volte si montava la feature sulla pagina
  vecchia non ancora nascosta.
- **`AbortSignal`.** Ogni `mount` asincrono riceve un `signal`. Se l'utente cambia pagina mentre la feature
  sta ancora caricando dati, il signal diventa `aborted` e la feature smette, senza inserire nulla nella
  pagina sbagliata. Per questo nel codice trovi spesso `if (signal.aborted) return;`.
- **Errori isolati.** Se una feature lancia un errore, viene loggato e le altre continuano.
- **Stop sicuro.** `stop()` annulla anche il frame eventualmente in coda.

### 7.3 Feature registrate

| Feature           | Routes                           | File                                                                                           |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `route-marker`    | `*`                              | [features/shell.ts](../src/scripts/features/shell.ts) — scrive `data-nebula-route` su `<html>` |
| `hero`            | `home`                           | [features/hero.ts](../src/scripts/features/hero.ts)                                            |
| `home-rails`      | `home`                           | [features/home-rails.ts](../src/scripts/features/home-rails.ts)                                |
| `details`         | `details`                        | [features/details.ts](../src/scripts/features/details.ts)                                      |
| `collections-hub` | `boxsets`, `playlists`           | [features/collections-hub.ts](../src/scripts/features/collections-hub.ts)                      |
| `watchlist-page`  | `home` (con `?nebula=watchlist`) | [features/watchlist-page.ts](../src/scripts/features/watchlist-page.ts)                        |
| `favorites-page`  | `home` (con `?tab=1`)            | [features/catalog-pages.ts](../src/scripts/features/catalog-pages.ts)                          |
| `library-pages`   | `movies`, `tv`                   | [features/catalog-pages.ts](../src/scripts/features/catalog-pages.ts)                          |

Le funzioni **globali** (navbar, menu laterale, tooltip, select, azioni card) non sono feature di route:
sono installate una volta in `start()` e reagiscono da sole a tutta la SPA.

---

## 8. Le feature, una per una

### 8.1 Home — hero (`features/hero.ts`)

1. Monta solo su `#/home` scheda 0, e **non** sulla vista watchlist.
2. Attende `#homeTab` nella pagina (con `waitFor`, che osserva solo quella pagina e ha un timeout).
3. Sceglie i titoli (`pickHeroItems`), in ordine di priorità:
   1. la raccolta curata chiamata come `heroCollectionName` («In evidenza») → badge «In evidenza»;
   2. altrimenti titoli in corso con backdrop;
   3. altrimenti ultimi aggiunti con backdrop.
4. Costruisce l'hero (max 5 slide, frecce, swipe, autoplay solo se abilitato e mai con tab nascosta o
   "riduci movimento") e lo mette **come primo figlio** di `#homeTab`.
5. Siccome Jellyfin/KefinTweaks a volte ricostruiscono la home dopo il caricamento, un `MutationObserver`
   limitato a `#homeTab` e al suo genitore lo reinserisce se viene tolto (stessa istanza: non si perdono
   slide o listener).

### 8.2 Home — rail (`features/home-rails.ts`)

- **«Le mie raccolte»**: raccolte (BoxSet) + playlist come card 16:9 con collage di 4 locandine.
  Se non c'è nulla: invito «Crea la tua prima raccolta» (solo a chi ha il permesso), altrimenti la rail
  non compare.
- **«Watchlist»**: titoli con `Likes = true`.
- Si inseriscono tra le sezioni di KefinTweaks usando la proprietà CSS `order` (raccolte `15`, dopo
  «Aggiunti di recente»; watchlist `60`, lo slot della rail watchlist di KefinTweaks, che è disattivata).
- Ascoltano gli eventi `COLLECTIONS_CHANGED`, `PLAYLISTS_CHANGED`, `WATCHLIST_CHANGED` e si ricaricano da sole.
- Stesso observer di reinserimento dell'hero.

### 8.3 Pagina watchlist (`features/watchlist-page.ts`)

URL: `#/home?nebula=watchlist` (costante `WATCHLIST_HREF` in [watchlist.ts](../src/scripts/watchlist.ts)).

**Perché dentro `home`?** Il router di Jellyfin non conosce route inventate: `#/watchlist` darebbe
«Pagina non trovata». Usando la route `home` reale con un parametro in più, il router è contento, il link
è condivisibile e il tasto Indietro funziona. `isWatchlistRoute(path, params)` è l'unico punto che decide
«siamo nella watchlist?»; hero e rail lo usano per **non** montarsi in quella vista, e il CSS
(`.nebula-watchlist-active`) nasconde il contenuto normale della home.

Flusso: pagina catalogo (§8.4) con filtro Tutti/Film/Serie e ordinamento →
`ctx.watchlist.list(limit, { startIndex, … })` → card poster native-actionable → si aggiorna a ogni
`WATCHLIST_CHANGED`.

Ci si arriva dal link «Watchlist» nella navbar (≥ 900 px, [navbar-extras.ts](../src/scripts/features/navbar-extras.ts))
o dalla voce «Watchlist» del menu laterale (< 900 px, [drawer-extras.ts](../src/scripts/features/drawer-extras.ts)).

### 8.4 Pagine catalogo: Film, Serie TV, Preferiti (`features/catalog-pages.ts` + `ui/catalog.ts`)

Film, Serie TV, Preferiti, Watchlist, Raccolte e Playlist hanno **la stessa impaginazione**: titolo in
gradiente con contatore accanto, sottotitolo, azioni, barra con filtri (pillola) e ordinamento (select glass),
griglia, «Carica altri». Il componente è `createCatalog` in [ui/catalog.ts](../src/scripts/ui/catalog.ts):

```
createCatalog({ title, filters, sorts, load({startIndex, limit, filter, sort}), card, stateKey })
 ├─ primo caricamento: load({ startIndex: 0, limit: max(60, quantità ricordata) })
 ├─ filtro/ordinamento cambiati → ricarica da zero; «Carica altri» → load({ startIndex: mostrati, limit: 60 }) e accoda
 ├─ risposte superate (l'utente ha già cambiato filtro) → ignorate, contatore di richiesta
 └─ destroy(): salva in sessionStorage filtro, ordinamento, quantità e scroll → tornando indietro da un
    dettaglio si ritrova la stessa posizione
```

- **Film e Serie** (`#/movies`, `#/tv`): `GET /Items?parentId=<libreria>` con filtri Tutti / Da vedere /
  In corso (solo film) / Visti. «Riproduci tutti» e «Casuale» cliccano i pulsanti della toolbar nativa
  (stessa logica di Jellyfin). Con il catalogo pronto, `html.nebula-catalog-mode` nasconde la seconda riga
  della navbar (selettore «Film ▾», contatore, filtri e paginazione MUI). **Se il primo caricamento fallisce
  si torna alla vista nativa** con la sua toolbar.
- **Preferiti** (`#/home?tab=1`): `GET /Items?filters=IsFavorite`, filtro Tutti/Film/Serie TV/Episodi.
- **Race risolta:** `hashchange` e `viewshow` ravvicinati smontano la prima istanza mentre aspetta i dati.
  Quando quella finisce non deve togliere le classi condivise alla seconda: `setCatalogMode(false)` e
  `hostCatalog` le rimuovono solo se nessun altro catalogo è ancora nel documento.

### 8.5 Pagina dettagli (`features/details.ts` + `details/*`)

È la feature più complessa. Principio: **il controller nativo di Jellyfin resta il padrone**. Nebula
aggiunge blocchi propri e nasconde (via CSS) le sezioni native che sostituisce, ma non le cancella.

```
mount (#/details?id=…)
 ├─ solo se la pagina è #itemDetailPage e il tipo è Movie/Series/Season/Episode/BoxSet
 ├─ in parallelo: attende .detailPageWrapperContainer  +  GET item completo
 ├─ se serie/stagione: carica la serie e il "prossimo episodio" (/Shows/NextUp)
 ├─ classi sulla pagina: nebula-detail, nebula-detail--<tipo>  → il CSS nasconde le parti native sostituite
 │
 ├─ 1. Hero (details/hero.ts)          inserito PRIMA del wrapper, a tutta larghezza
 │       backdrop + logo/titolo + metadati + Riproduci/Riprendi + Watchlist + Aggiungi a… + «Altre azioni»
 │       «Altre azioni» = menu costruito leggendo i pulsanti nativi visibili (details/native.ts)
 ├─ 2. Stagioni ed episodi (details/episodes.ts)   order 1  (solo serie/stagione/episodio)
 ├─ 3. Informazioni (details/info.ts)               order 2  + interruttore «Dettagli tecnici» che mostra
 │                                                         il contenuto nativo (tracce, versioni, tag…)
 │     (se BoxSet: filtro Tutti/Film/Serie + avviso "raccolta condivisa")
 ├─ 4. Cast e troupe (details/cast.ts)              order 4  (stagioni: cast della serie)
 ├─ 5. Potrebbe piacerti (details/related.ts)       order 5  (/Items/{id}/Similar, deduplicato)
 └─ 6. Seerr (JE) raggruppato a schede              order 6
```

I blocchi Nebula vengono aggiunti nel wrapper flex nativo con `style.order`: **l'ordine visivo** è dato dal
CSS, non spostando nodi nativi (che Jellyfin potrebbe voler ritrovare dove li aveva messi).

**Le azioni passano dal nativo.** Il pulsante «Riproduci» dell'hero Nebula non avvia il player da sé:
trova il pulsante nativo `.mainDetailButtons .btnPlay` (nascosto) e ci fa `click()` (`triggerNative`).
Il menu «Altre azioni» elenca i pulsanti nativi visibili _in quel momento_ (preferito, visto, scarica,
menu «…», pulsanti aggiunti da KefinTweaks/JE…) e ciascuna voce clicca il pulsante originale. Risultato:
nessuna logica duplicata, e se un plugin aggiunge un pulsante, compare da solo nel menu.

### 8.6 Raccolte e Playlist (`features/collections-hub.ts`)

Due pagine distinte con l'intestazione del catalogo e griglia 16:9 con collage: `#/boxsets` mostra **solo
le raccolte** (azione «Nuova raccolta», per chi ha il permesso), `#/playlists` **solo le playlist** (azione
«Nuova playlist»). Niente selettore Tutte/Raccolte/Playlist: la navbar ha già la voce Playlist.
**La griglia nativa viene nascosta solo dopo che la pagina è stata disegnata con successo**: se il
caricamento fallisce, l'utente vede la pagina standard di Jellyfin.

### 8.7 Dialog raccolte e playlist (`features/collection-dialogs.ts` + `ui/title-picker.ts`)

Crea raccolta / playlist, «Aggiungi a…» (raccolte e playlist con spunta), gestisci. Il selettore titoli si
apre **già con la libreria** (ultimi aggiunti) in una griglia di locandine: si sfoglia o si cerca dal primo
carattere, si tocca la locandina per includerla (è una checkbox reale, accessibile), filtro per tipo
(le playlist hanno anche «Episodi»), «Carica altri», riepilogo dei selezionati con «Deseleziona tutto». Ogni azione chiama le API reali e mostra **l'esito confermato dal server**
(vedi §10.3).

### 8.8 Funzioni globali

| Funzione                   | File                        | Cosa fa                                                                                                                                                                                                 |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyShell`               | `features/shell.ts`         | Classi `nebula-active`, `nebula-layout-*` su `<html>`.                                                                                                                                                  |
| `installNavbarExtras`      | `features/navbar-extras.ts` | Logo-link Home e link «Watchlist» nella navbar MUI; li reinserisce se React ricostruisce la toolbar; tornando in home riporta KefinTweaks sulla categoria standard.                                     |
| `installDrawerExtras`      | `features/drawer-extras.ts` | Menu laterale = unica navigazione su telefono (nessuna barra in basso). Aggiunge «Watchlist» dopo «Preferiti» clonando le classi MUI della voce nativa; il drawer si chiude da solo al cambio di route. |
| `installNativeCardActions` | `features/card-actions.ts`  | Al primo hover/focus su una card nativa aggiunge «watchlist» e «Aggiungi a…». Solo con mouse vero; su touch resta il menu ⋮ nativo. Nessun observer: delega su `pointerover`/`focusin`.                 |
| `installWatchlistSync`     | `ui/watchlist-button.ts`    | Quando un titolo entra/esce dalla watchlist, aggiorna **tutti** i pulsanti di quel titolo in pagina.                                                                                                    |
| `installGlassSelect`       | `ui/glass-select.ts`        | Intercetta l'apertura di una `<select>` e mostra un popup glass; la scelta viene scritta sulla select originale.                                                                                        |
| `installTooltips`          | `ui/tooltip.ts`             | Sposta `title` in `data-nebula-tip` e mostra un tooltip glass; al teardown ripristina il `title`.                                                                                                       |
| `installJeIconTokenFix`    | `compat/je-icon-tokens.ts`  | Vedi §12.                                                                                                                                                                                               |
| `disableScreensaver`       | `compat/no-screensaver.ts`  | Vedi §12.                                                                                                                                                                                               |

---

## 9. Come Nebula convive con Jellyfin e i plugin

Queste regole spiegano quasi tutte le scelte "strane" che vedrai nel codice.

1. **Nascondere, non distruggere.** Le parti native sostituite vengono nascoste con CSS condizionato a una
   classe messa dal JS. Spegnendo Nebula, la classe sparisce e tutto ricompare.
2. **Delegare, non reimplementare.** Play, preferiti, visto, menu contestuale, versioni, tracce: Nebula
   clicca i pulsanti nativi. Le card Nebula vivono dentro un `<div is="emby-itemscontainer">` con gli stessi
   attributi `data-id`, `data-type`, `data-serverid`, `data-positionticks`… delle card native, così il
   codice di Jellyfin (click, riproduci, menu ⋮) le gestisce come se fossero sue.
3. **Observer stretti.** Ogni `MutationObserver` osserva solo il contenitore che interessa (`#homeTab`, la
   toolbar, `<head>`), quasi sempre solo `childList`. Mai `document` intero con `subtree`.
4. **Reinserire con pazienza.** React e KefinTweaks a volte ricostruiscono parti della pagina. Hero, rail,
   watchlist e link della navbar hanno un piccolo observer che li rimette al loro posto.
5. **Elementi fuori da React.** Dialog, menu, toast sono montati direttamente in `<body>` con classe
   `.nebula-root`: React non li vede e non li può rimuovere, e lo `stop()` li ritrova tutti.
6. **Niente `innerHTML` con dati utente.** Il DOM si costruisce con l'helper `h()` di
   [ui/dom.ts](../src/scripts/ui/dom.ts), che usa solo `textContent` e attributi.
7. **Compatibile con React.** La select glass scrive il valore con il setter del prototipo e lancia
   `input`/`change`, altrimenti i componenti React non si accorgerebbero del cambio.
8. **Plugin: si adatta lo stile, non si cambia la config.** In `plugin-compat.css` si sistemano/nascondono
   elementi di KefinTweaks e JE (breadcrumb, selettore tema, effetti stagionali, flussi attivi…). Le
   impostazioni dei plugin restano tue.

---

## 10. Il flusso dei dati: API, servizi, eventi

### 10.1 Il client API (`jellyfin-api.ts`)

```
JellyfinApi(session)
  request(method, path, query, body)
    ├─ URL = serverUrl + path + query
    ├─ header  Authorization: MediaBrowser Token="<token dell'utente loggato>"
    ├─ errore HTTP → ApiError(status…)  (isForbidden per 401/403)
    └─ GET identiche in corso → condivise (una sola richiesta di rete)
```

Il token è **quello della sessione dell'utente**, letto da `window.ApiClient`: Nebula può fare
esattamente ciò che l'utente può fare, niente di più. Nessuna API key, nessun proxy.

Endpoint usati (principali):

| Scopo                         | Endpoint                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Utente e permessi             | `GET /Users/Me`                                                              |
| Librerie (per la barra)       | `GET /UserViews`                                                             |
| Titoli                        | `GET /Items`, `GET /Items/{id}`                                              |
| Serie                         | `GET /Shows/{id}/Seasons`, `/Shows/{id}/Episodes`, `/Shows/NextUp`           |
| Suggerimenti                  | `GET /Items/{id}/Similar`                                                    |
| Watchlist                     | `POST`/`DELETE /UserItems/{id}/Rating?likes=true` (campo `UserData.Likes`)   |
| Raccolte                      | `POST /Collections?name&ids`, `POST`/`DELETE /Collections/{id}/Items?ids`    |
| Playlist                      | `POST /Playlists`, `/Playlists/{id}/Items`, `…/Items/{entryId}/Move/{index}` |
| Immagine/descrizione raccolta | `updateOverview`, `uploadPrimaryImage`                                       |

### 10.2 I servizi

| Servizio             | File             | Ruolo                                                                                              |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `CollectionsService` | `collections.ts` | Elenco raccolte (cache 60 s), membri, crea/aggiungi/rimuovi/elimina. Emette `COLLECTIONS_CHANGED`. |
| `PlaylistService`    | `playlist.ts`    | Come sopra per le playlist. Emette `PLAYLISTS_CHANGED`.                                            |
| `WatchlistService`   | `watchlist.ts`   | `set(id, true/false)` su `Likes`, `list()`. Emette `WATCHLIST_CHANGED`.                            |

Regole di dominio importanti:

- **Watchlist = `Likes`, non i Preferiti.** È lo stesso campo usato da Jellyfin Enhanced (sync con Seerr)
  e KefinTweaks, così la watchlist è una sola per tutti.
- **Episodi e stagioni → serie.** Aggiungere un episodio alla watchlist o a una raccolta aggiunge la sua
  serie (`watchlistTargetId`, `collectionTargetId`).
- **Le raccolte di Jellyfin sono globali** (visibili a tutti): l'interfaccia lo dice esplicitamente.
  Crearle richiede admin o il permesso «gestione raccolte» (`canManageCollections`).

### 10.3 Scritture sicure

```
add(collectionId, ids)
  └─ MutationQueue.run(collectionId, …)        ← una sola scrittura alla volta per raccolta
        ├─ POST /Collections/{id}/Items?ids=…
        ├─ verify(): rilegge i membri dal server
        │     unconfirmed = ids che il server NON conferma
        ├─ notify() → svuota cache + evento COLLECTIONS_CHANGED
        └─ ritorna { collectionId, unconfirmed }  → la UI mostra l'esito reale
```

Perché la coda: Jellyfin salva ogni raccolta in un file `collection.xml`; due scritture contemporanee
sulla stessa raccolta possono fallire lato server. Perché la verifica: l'utente vede ciò che il server ha
davvero salvato, non ciò che speriamo.

La watchlist fa lo stesso in piccolo: `set()` aspetta un'eventuale scrittura in corso sullo stesso titolo
e poi pubblica lo stato **restituito dal server**.

### 10.4 Gli eventi

Gli eventi sono `CustomEvent` emessi su `document`:

| Evento                               | Chi lo emette        | Chi lo ascolta                                               |
| ------------------------------------ | -------------------- | ------------------------------------------------------------ |
| `biaflix-nebula:watchlist-changed`   | `WatchlistService`   | tutti i pulsanti watchlist, rail watchlist, pagina watchlist |
| `biaflix-nebula:collections-changed` | `CollectionsService` | rail raccolte, hub                                           |
| `biaflix-nebula:playlists-changed`   | `PlaylistService`    | rail raccolte, hub                                           |

Così i componenti non si conoscono tra loro: chi scrive annuncia, chi mostra si aggiorna.

---

## 11. Tre esempi seguiti dall'inizio alla fine

### 11.1 «Apro la home»

```
URL #/home  → Jellyfin mostra #indexPage e lancia 'viewshow'
Lifecycle.apply(): path 'home' → monta route-marker, hero, home-rails, watchlist-page, favorites-page
  route-marker:   <html data-nebula-route="home">
  watchlist-page / favorites-page: né ?nebula=watchlist né ?tab=1 → non fanno nulla
  hero:           aspetta #homeTab → sceglie titoli via API → inserisce l'hero in cima
  home-rails:     aspetta il contenitore sezioni → inserisce 2 rail con skeleton
                  → carica raccolte+playlist e watchlist → riempie le rail
KefinTweaks ricostruisce le sezioni → gli observer reinseriscono hero e rail
navbar-extras (globale): evidenzia/ripristina la categoria KefinTweaks standard
```

### 11.2 «Apro una serie e premo Riproduci»

```
click su una card → Jellyfin naviga a #/details?id=XYZ, mostra #itemDetailPage
Lifecycle: smonta le feature della home (abort + cleanup) → monta 'details'
details.mount:
  GET item XYZ (Series) + serie + NextUp
  classi nebula-detail nebula-detail--series → CSS nasconde stagioni/episodi/simili nativi
  hero → episodi → info → cast → potrebbe piacerti → seerr
click su «Riproduci» nell'hero Nebula
  → triggerNative(page, 'btnPlay') → click sul pulsante nativo nascosto
  → il player di Jellyfin parte come sempre (con la logica di ripresa nativa)
```

### 11.3 «Aggiungo un film alla watchlist da una card»

```
hover su una card nativa → card-actions inserisce [segnalibro] [Aggiungi a…]
click sul segnalibro
  → WatchlistService.set(id, true) → POST /UserItems/{id}/Rating?likes=true
  → il server risponde Likes: true
  → evento WATCHLIST_CHANGED { itemId, listed: true }
      ├─ installWatchlistSync: tutti i pulsanti di quel film diventano "aggiunto"
      ├─ rail watchlist in home: si ricarica
      └─ pagina watchlist (se aperta): si ricarica
```

---

## 12. Correttivi di compatibilità (`compat/`)

Piccoli interventi su difetti di terzi, ognuno isolato in un file e documentato in
[compatibility.md](compatibility.md):

| Problema                                                                                                                                                                                                                    | Correttivo                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| JE 12.12 con «Use Icons» spento mostra testi tipo `{{icon:warning}} …`                                                                                                                                                      | `je-icon-tokens.ts` avvolge `JE.t` e toglie i segnaposto rimasti; allo stop rimette l'originale.                  |
| Screensaver di Jellyfin dopo inattività (non voluto)                                                                                                                                                                        | `no-screensaver.ts` imposta `localStorage['<userId>-screensaver'] = 'none'` (stessa chiave usata da JellyTweaks). |
| Le rail native usano uno scroller che ha `overflow: hidden` solo in modalità TV → la pagina scorreva in orizzontale                                                                                                         | Regola in `rails.css` sullo scroller (alla radice, niente `overflow-x: hidden` globale).                          |
| Frecce `.je-scroll-btn` di JE duplicate/rotte                                                                                                                                                                               | Nascoste in `plugin-compat.css` quando esistono quelle native.                                                    |
| Player (`#/video`): jellyfin-web lascia l'AppBar montata ma vuota; la barra flottante restava come linea sopra il video e lo spacer spingeva giù l'header OSD di 86px (striscia chiara in alto, video «scurito»)            | `navbar.css`: `header.MuiAppBar-root:empty` nascosta e spacer a 0. Test: `player-playlist.spec.ts`.               |
| Playlist (e album): due CSS opzionali di KefinTweaks per le griglie episodi (Ultrachromic `episodes_grid.css`, ScyFlow `EpisodeGrid.css`) rendevano ogni lista della pagina dettagli una griglia a 3–4 colonne senza titoli | `plugin-compat.css`: `#listChildrenCollapsible` torna lista verticale glass (2 id battono i loro `!important`).   |
| Menu del player (sottotitoli, audio, velocità): jellyfin-web impone `border-radius: .1em !important` → riquadro squadrato con bordo glass                                                                                   | `base.css`: raggio Nebula sugli `.actionSheet`.                                                                   |
| Popup glass delle select e tooltip sotto i dialog nativi (`.dialogContainer`, z-index 999999)                                                                                                                               | Token `--nebula-z-popover` sopra i dialog nativi.                                                                 |

Errori noti **non nostri** (compaiono anche senza Nebula): `seriesEpisodes.js:760` di KefinTweaks e
`emby-scrollbuttons scrollHandler` di jellyfin-web. I test E2E li ignorano esplicitamente
(`PREEXISTING_PAGE_ERRORS`).

---

## 13. Mappa dei file

```
src/
├─ scripts/
│  ├─ main.ts               avvio, start/stop, API globale window.BiaflixNebula
│  ├─ injector-snippet.js   modello dello snippet per JS Injector
│  ├─ flags.ts              config + flag + interruttore locale
│  ├─ skin-detect.ts        «la skin Nebula è attiva?»
│  ├─ env.ts                sessione, route corrente, navigazione, tipo di layout
│  ├─ lifecycle.ts          monta/smonta le feature al cambio pagina
│  ├─ context.ts            tipo del contesto condiviso
│  ├─ jellyfin-api.ts       client HTTP tipizzato
│  ├─ collections.ts        servizio raccolte
│  ├─ playlist.ts           servizio playlist
│  ├─ watchlist.ts          servizio watchlist + route della pagina watchlist
│  ├─ mutation-queue.ts     scritture in fila per chiave
│  ├─ cards.ts              card poster/landscape/raccolta "native-actionable"
│  ├─ images.ts             scelta immagini e srcset
│  ├─ i18n.ts               testi it/en
│  ├─ features/             funzioni montate per route o installate globalmente (§8)
│  ├─ details/              blocchi della pagina dettagli (hero, episodi, info, cast, correlati, ponte nativo)
│  ├─ ui/                   componenti riutilizzabili: dom, dialog, menu, rail, toast, tooltip,
│  │                        glass-select, title-picker, watchlist-button, wait
│  └─ compat/               correttivi per plugin/Jellyfin (§12)
├─ styles/                  CSS (§5)
└─ assets/                  logo

tests/
├─ unit/   Vitest + happy-dom: logica pura e DOM simulato (API, servizi, lifecycle, componenti)
└─ e2e/    Playwright contro un Jellyfin vero in Docker (home, dettagli, raccolte, watchlist,
           navbar, mobile, responsive, controlli)

dev/       script per l'ambiente locale (§14)
tools/     build.mjs
docs/      SPEC, install, rollback, compatibility, plugin-audit, QA, questo file
dist/      output della build, pubblicato
```

---

## 14. Ambiente di sviluppo e test

Tutto gira **in locale**, su `127.0.0.1:8097`. Gli script `dev/` rifiutano di scrivere su qualunque
indirizzo che non sia localhost.

| Comando            | Cosa fa                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:up`      | Avvia un container `jellyfin/jellyfin:12.2…` con dati in `dev/.data` e media sintetici generati (`gen-media.sh`). Monta `dist/` in sola lettura.                                                                  |
| `pnpm dev:seed`    | Wizard iniziale, librerie Film/Serie, utenti di test: `admin`, `curatrice` (può gestire raccolte), `spettatore` (no).                                                                                             |
| `pnpm dev:plugins` | Installa i plugin, riavvia, e con `kefin-config.mjs` replica gli script JS Injector della produzione leggendo **solo** l'endpoint pubblico `/JavaScriptInjector/public.js` (cache in `dev/.data/prod-public.js`). |
| `pnpm dev:down`    | Ferma il container.                                                                                                                                                                                               |
| `pnpm build:watch` | Ricompila a ogni modifica.                                                                                                                                                                                        |
| `pnpm check`       | typecheck + stylelint + test unitari + build.                                                                                                                                                                     |
| `pnpm test`        | Solo test unitari.                                                                                                                                                                                                |
| `pnpm test:e2e`    | Playwright: Firefox 1080p, Chromium 1366, Chromium mobile.                                                                                                                                                        |

**Come i test E2E caricano Nebula** ([tests/e2e/fixtures.ts](../tests/e2e/fixtures.ts)): intercettano le
richieste verso l'URL di jsDelivr e servono i file di `dist/` locali, simulando lo Skin Manager. Così si
prova **esattamente la build** che verrebbe pubblicata, nel DOM reale di KefinTweaks e JE.
`NEBULA_DIST` permette di servire una build diversa (es. quella in produzione, per screenshot «prima»).
Gli screenshot finiscono in `test-results/screenshots` (non versionati).

---

## 15. Rilascio, aggiornamento, spegnimento e rollback

### Rilasciare una nuova versione

1. Aggiorna `version` in `package.json`.
2. `pnpm check` e `pnpm test:e2e` verdi.
3. `pnpm build` (aggiorna `dist/`, compreso lo snippet con il nuovo URL).
4. Commit, push, tag `vX.Y.Z` su GitHub.
5. In Jellyfin: aggiorna l'URL di `nebula.css` nello Skin Manager e lo snippet in JS Injector.
6. Gli utenti ricaricano la pagina.

### Spegnere Nebula, dal più leggero al più drastico

| Livello                      | Come                                                                 | Effetto                                                                   |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Solo il mio browser, al volo | Console: `BiaflixNebula.disable()` (riaccendi con `enable()`)        | Spegne il JS in questo browser, persistente (localStorage). Il CSS resta. |
| Una funzione per tutti       | Nello snippet JS Injector: es. `hero: false`                         | Disattiva quella funzione.                                                |
| Tutto il JS per tutti        | Snippet: `enabled: false`, oppure disattiva lo script in JS Injector | Resta solo l'aspetto (CSS).                                               |
| Tutto per un utente          | Scegliere un'altra skin in KefinTweaks                               | CSS e JS si spengono insieme.                                             |
| Tutto per tutti              | Default skin ≠ Nebula + script JS Injector disattivato               | Jellyfin come prima.                                                      |
| Versione precedente          | Rimettere negli URL il tag precedente                                | Rollback esatto.                                                          |

Procedura completa: [rollback.md](rollback.md).

---

## 16. Debug: come capire cosa sta succedendo

In console del browser:

```js
BiaflixNebula.version; // versione caricata (verifica che sia quella pubblicata)
BiaflixNebula.state; // 'idle' | 'starting' | 'running'
BiaflixNebula.flags; // flag effettivi dopo la config
document.querySelector('link[data-kefin-skin="true"]')?.dataset.skin; // skin attiva
getComputedStyle(document.documentElement).getPropertyValue('--biaflix-nebula'); // "1" se il CSS è applicato
document.documentElement.className; // deve contenere nebula-active se il JS è partito
```

- Nessun messaggio `[Biaflix Nebula] … attiva per <utente>` → con `debug: true` nello snippet compare;
  se `state` è `idle`, guarda se la skin è davvero Nebula.
- `feature "xyz"` + errore in console → una feature ha fallito; le altre girano. Il nome dice dove guardare.
- Per capire se un problema è di Nebula: `BiaflixNebula.disable()`, ricarica, riprova. Se persiste, è di
  Jellyfin o di un plugin. Poi `BiaflixNebula.enable()`.

---

## 17. Domande frequenti sul «perché»

**Perché due canali (skin + JS Injector) e non uno solo?**
Il CSS deve poter essere scelto per utente/browser e convivere con le altre skin: lo Skin Manager di
KefinTweaks fa esattamente questo. Il JS deve essere caricato in tutte le pagine: è il compito di JS
Injector. Il JS controlla la skin per non attivarsi da solo.

**Perché non modificare direttamente i file di Jellyfin Web (File Transformation)?**
Si dovrebbe toccare il server e rifare il lavoro a ogni aggiornamento di Jellyfin. Così invece niente
sul server cambia, e un aggiornamento di Jellyfin al massimo richiede di sistemare qualche selettore.

**Perché tanti observer e "reinserimenti"?**
Perché la pagina non è nostra: React, le view legacy e KefinTweaks la ridisegnano quando vogliono. Invece
di combatterli, Nebula si rimette al suo posto quando viene tolta, osservando solo il minimo indispensabile.

**Perché la watchlist è `#/home?nebula=watchlist` e non una pagina sua?**
Il router di Jellyfin non accetta route nuove dall'esterno; la pagina watchlist di KefinTweaks in Jellyfin 12
Modern dà «Pagina non trovata». Appoggiarsi a `home` mantiene link, Indietro e ricarica funzionanti.

**Perché i pulsanti dell'hero cliccano quelli nativi?**
Per non duplicare logica delicata (ripresa, versioni multiple, trailer, permessi) e per far comparire
automaticamente i pulsanti aggiunti dai plugin.

**Perché la verifica dopo ogni scrittura?**
Le API possono rispondere "ok" ma ignorare alcuni id (permessi, tipi non ammessi): l'utente deve vedere
ciò che il server ha davvero salvato.

**Dove sono i dati di Nebula?**
Da nessuna parte di "suo": raccolte, playlist e watchlist sono dati standard di Jellyfin. Il localStorage
è usato solo per comodità locali (interruttore personale, screensaver), mai come fonte di verità.
