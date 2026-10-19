# QA

## Navbar essenziale (19/10/2026)

Rimosso il controllo Home/Discover creato da Nebula e nascosto quello nativo di KefinTweaks. La home standard viene ripristinata con il pulsante nativo `data-category-id="none"` all'ingresso nella route home: una precedente selezione Scopri non lascia un filtro nascosto. La watchlist conserva il suo pannello; il ritorno alla home passa dal logo su desktop e dalla barra inferiore su mobile.

**Active Streams, causa verificata:** con il widget realmente abilitato nella configurazione intercettata dal browser, il bridge MUI applica `.MuiToolbar-root .headerButton.paper-icon-button-light { display: inline-flex !important; }`. La vecchia regola Nebula `display: none` perdeva. Il test di regressione falliva con `display: flex` invece di `none`; l'override è ora `!important`, limitato agli ID del widget e del suo pannello. Il test abilita anche la visibilità per il viewer, verifica che il pulsante esista e controlla il display effettivo, evitando il falso positivo del vecchio test su un widget disabilitato o già in overflow.

**Verifica finale mirata:** `pnpm exec playwright test tests/e2e/navbar.spec.ts tests/e2e/responsive.spec.ts --grep 'navbar essenziale|Navbar responsive'`: **5 superati, 1 saltato per profilo, 0 falliti**. La matrice 320/390/600/768/1024/1366/1920px della navbar passa su Firefox e Chromium: risolta la sovrapposizione Home/Discover–launcher documentata sotto come preesistente. Le prove homepage, tooltip e tema unico sono passate nella precedente esecuzione; il nuovo test navbar verifica logo desktop, Home e Watchlist nella barra inferiore mobile.

`pnpm check`: typecheck, lint CSS, **55 unit test** e build superati. I test dedicati controllano anche ritorno da Scopri alla home, assenza del selettore originale, apertura/chiusura della watchlist e assenza del comando Active Streams nel launcher JE. I dati delle sessioni sono sintetici, senza modifiche alla configurazione server.

## Pagina Attività Nebula (19/10/2026)

**Ambiente:** Jellyfin 12.2 locale con JE 12.12 e KefinTweaks 0.5.1. Il Native Tab Attività è abilitato esclusivamente nelle risposte intercettate dal browser; nessuna impostazione server viene modificata. Attività, recensioni e stream sintetici; miniature dei media locali.

- `pnpm check`: typecheck, lint CSS, **55 unit test** e build superati.
- `tests/e2e/activity.spec.ts`: **9/9 superati** su Firefox 1920×1080, Chromium 1366×768 e mobile 390×844. Include matrice 320/390/600/768/1024/1366/1920px, titoli lunghi, immagini caricate e fallback senza immagine, recensione con stelle, avanzamento parziale/completo, refresh, stati vuoti, errore 503 e recupero, rimozione stream su 403, navigazione ai dettagli, focus da tastiera e movimento ridotto.
- Regressioni calendario e homepage: **22 E2E superati, 2 saltati per profilo, 0 falliti**, con `pnpm exec playwright test tests/e2e/calendar.spec.ts tests/e2e/home.spec.ts`.
- Prettier sui sorgenti modificati e `git diff HEAD --check` superati. Screenshot desktop/mobile e stati vuoti esaminati in `test-results/screenshots/activity-{populated,empty}-*.png`.

**Limiti:** testata la navigazione Native Tab reale; host Plugin Pages, Safari/iOS e dispositivi fisici non verificati. Il test 403 verifica la reazione del renderer; le autorizzazioni backend restano di Jellyfin Enhanced.

## Calendario Nebula (19/10/2026)

Restyling CSS di Jellyfin Enhanced 12.12 verificato contro il plugin installato nel container locale. Eventi e user-data sono sintetici, intercettati da Playwright; nessuna istanza Sonarr/Radarr o dato di produzione viene consultato dalla suite.

- `pnpm check`: typecheck, lint CSS, **55 test unitari** e build superati.
- Prettier sui file sorgente modificati e `git diff HEAD --check`: superati.
- `tests/e2e/calendar.spec.ts`: agenda, filtri e inversione NOT, cambio periodo/Oggi, viste giorno/settimana/mese e modalità lista/backdrop/card, stato vuoto, focus e movimento ridotto. Profili Firefox 1920×1080, Chromium 1366×768, mobile 390×844; matrice aggiuntiva agenda/mese a 320/600/768/900/1024/1450/1920px.
- Esecuzione finale sequenziale: **32 E2E superati, 7 saltati per profilo, 0 falliti**, con `pnpm exec playwright test tests/e2e/calendar.spec.ts tests/e2e/home.spec.ts tests/e2e/responsive.spec.ts --grep-invert 'Navbar responsive'`. Include **10 verifiche calendario**, 12 homepage e 10 dettagli responsive. Il test navbar escluso ha un difetto preesistente verificato separatamente (vedi sotto).
- Screenshot esaminati in `test-results/screenshots/calendar-{agenda,month,empty}-*.png`. La chiusura dei filtri attende la fine della transizione CSS prima della cattura.

**Problema preesistente rilevato nella suite allargata:** nella homepage, la navbar a 320px sovrappone «Discover» e «Altro da Jellyfin Enhanced». Riprodotto con `NEBULA_DIST` puntato a una copia di `dist/` con il CSS originale di `HEAD`, nel test `Navbar responsive` su Firefox. Il calendario non modifica i selettori della navbar.

**Limiti:** testata la pagina dedicata con renderer reale; navigazione Native Tab/Plugin Pages, Safari/iOS, dispositivi fisici e integrazione effettiva Sonarr/Radarr non verificati. Le prime esecuzioni E2E sovrapposte hanno prodotto fallimenti di autenticazione nell'ambiente locale (schermata di login al posto della home); la successiva esecuzione in un unico processo è passata.

## v0.2.0: pagina dettagli e responsive (19/10/2026)

**Ambiente:** Jellyfin 12.2 locale con gli **stessi plugin della produzione** (`pnpm dev:plugins`): KefinTweaks 0.5.1 con la tua configurazione pubblica, Jellyfin Enhanced 12.12.0.0, JS Injector 4.0.0.0, File Transformation 3.0.2.0, Plugin Pages 3.0.2.0. I media sintetici sono stati arricchiti (`dev/enrich-media.sh`, `dev/people-images.mjs`): cast di 14 persone (metà senza foto), regia, studi, 12 tag, seconda stagione, logo, film senza backdrop.

**Risultati:** `pnpm check` verde (typecheck, stylelint, **49/49** unit, build), Prettier verde, **E2E 82 superati, 0 falliti** (20 saltati: test solo-desktop o solo-mobile nei profili non pertinenti).

| Verifica                                                                                                                                             | Esito                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Nessuno scroll orizzontale del documento: film, film senza backdrop, serie, stagione, episodio × 320/390/600/768/1024/1366/1920 × Firefox e Chromium | ✅ (v0.1.1: fino a +1483px)         |
| Navbar senza sovrapposizioni né tagli alle 7 larghezze; drawer apribile e chiudibile da tastiera (Esc), un solo hamburger                            | ✅                                  |
| Un solo hero, un solo Riproduci; sezioni native sostituite non visibili (stagioni, prossimo, episodi KefinTweaks, cast, simili)                      | ✅                                  |
| Riproduci dell'hero (film) e Play episodio → player nativo `#/video`                                                                                 | ✅                                  |
| Cambio stagione con click e con le frecce (tablist)                                                                                                  | ✅                                  |
| Cast: ritratti 1:1 circolari, ruolo sotto il nome, iniziali senza foto, «Mostra tutto»                                                               | ✅                                  |
| «Altre azioni»: azioni native senza duplicati; Preferito salvato sul server; tastiera (↓, Esc, focus di ritorno)                                     | ✅                                  |
| Dettagli tecnici a scomparsa (tag, Media Info, tracce); fallback hero senza backdrop                                                                 | ✅                                  |
| Skin disattivata a caldo: la pagina nativa torna intatta                                                                                             | ✅                                  |
| Raccolte (criterio §7), watchlist, hub, controlli glass, dashboard nativa                                                                            | ✅ (suite esistenti)                |
| Nessun nuovo errore in console                                                                                                                       | ✅ (vedi errore preesistente sotto) |

Le immagini non sono versionate: gli screenshot (matrice responsive, prima/dopo con `NEBULA_DIST` + `SHOT_TAG=before`) si rigenerano in locale in `test-results/screenshots/` lanciando `pnpm test:e2e`.

**Errore preesistente, non causato da Nebula:** KefinTweaks 0.5.1 `seriesEpisodes.js:760` («Cannot read properties of undefined (reading 'Items')») sulle pagine serie. Si riproduce identico con Nebula disattivata ed è escluso dai test con un filtro mirato (`PREEXISTING_PAGE_ERRORS`). Nebula sostituisce comunque quella sezione con «Stagioni ed episodi».

**Errore intermittente di jellyfin-web (non di Nebula):** «this.scrollHandler is not a function» (`emby-scrollbuttons.js:167`). Compare quando il view manager nativo rimuove una pagina dallo `skinBody` nello stesso frame in cui una riga si è agganciata; l'ho visto 2 volte su 12 ripetizioni, solo con le navigazioni istantanee dei test. Nebula non rimuove nodi da `skinBody`. Non l'ho riprodotto a Nebula spenta, perché è raro anche con Nebula attiva. È filtrato in modo mirato.

**Non verificabile in locale:**

- sezioni Seerr di JE (Recommended/Similar): richiedono un'istanza Seerr. Il raggruppamento in «Scopri e richiedi» si basa sul DOM documentato di JE 12.12 (`.jellyseerr-details-section`) ed è da verificare in produzione;
- Spoiler Guard attivo (in produzione è OFF);
- Safari/iOS e dispositivi touch reali (testata l'emulazione mobile Chromium).

**Nota sulla tua configurazione:** l'animazione stagionale di Halloween di KefinTweaks (frangia rossa sotto la navbar) resta attiva, perché è una tua impostazione. La specifica la indica come da spegnere (Seasonal Animations / Backgrounds: OFF).

## Ambiente di test

Istanza **locale e isolata** di Jellyfin 12.2 (`jellyfin/jellyfin:12.2.20261005-225228`, porta `127.0.0.1:8097`), con media sintetici generati da ffmpeg (5 film, 3 serie; nessun contenuto reale) e tre utenti:

| Utente       | Ruolo                                   |
| ------------ | --------------------------------------- |
| `admin`      | amministratore                          |
| `curatrice`  | non admin con «Gestione raccolte»       |
| `spettatore` | non admin senza permessi sulle raccolte |

```bash
pnpm install
pnpm dev:up      # genera media sintetici + avvia il container (solo localhost)
pnpm dev:seed    # wizard, librerie, utenti (rifiuta qualsiasi URL non localhost)
pnpm check       # typecheck + stylelint + unit test + build
pnpm test:e2e    # Playwright: Firefox 1080p, Chromium 1366×768, mobile 390×844
pnpm dev:down    # ferma (con --purge rimuove anche config/cache locali)
```

L'E2E simula lo Skin Manager KefinTweaks inserendo lo stesso `<link data-kefin-skin="true" data-skin="Biaflix Nebula">` e serve `dist/` come farebbe il CDN.

## Risultati (19/10/2026, v0.1.0)

- **Unit (Vitest + happy-dom): 37/37 ✅**: client API (firme 12.2, auth, de-dupe, guardia sull'eliminazione), servizio raccolte con server finto stateful (creazione mista, verifica post-scrittura, esiti non confermati, rimozione, appartenenza, cache), coda mutazioni, flag/kill switch, i18n, helper card, rilevamento skin, lifecycle (incluso il test di regressione per `hashchange`+`viewshow` nello stesso frame), rail che sopravvivono al ridisegno nativo, dialog accessibile.
- **E2E (Playwright): 40 superati, 11 saltati per progetto (test solo-desktop o solo-mobile), 0 falliti.**

| Scenario                                                                                                                                                                                                       | Firefox 1920×1080 | Chromium 1366×768 | Mobile 390×844         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------- | ---------------------- |
| Home: hero, navbar glass, rail, nessun errore JS                                                                                                                                                               | ✅                | ✅                | ✅                     |
| Nessun overflow orizzontale                                                                                                                                                                                    | ✅                | ✅                | ✅                     |
| JS spento senza skin Nebula / smontaggio a caldo                                                                                                                                                               | ✅                | ✅                | ✅                     |
| **Criterio §7**: raccolta 2 film + 2 serie dalla UI → home → apertura → aggiunta da «Aggiungi a…» → rimozione con conferma (file intatto) → reload → secondo utente non admin (vede, non modifica, server 403) | ✅                | ✅                | — (desktop)            |
| Hub `#/boxsets`: filtro e vista classica                                                                                                                                                                       | ✅                | ✅                | —                      |
| Watchlist = Likes (≠ Preferiti), persistente, rail in home                                                                                                                                                     | ✅                | ✅                | ✅                     |
| Hero «Riproduci» → player nativo (`#/video`)                                                                                                                                                                   | ✅                | ✅                | ✅                     |
| Hero: navigazione manuale, nessun autoplay                                                                                                                                                                     | ✅                | ✅                | —                      |
| Quick action su card native da tastiera, click card non bloccato                                                                                                                                               | ✅                | ✅                | — (touch: menu nativo) |
| Mobile: hero 45–70% viewport, max 2 CTA                                                                                                                                                                        | —                 | —                 | ✅                     |
| `prefers-reduced-motion`: nessuna trasformazione                                                                                                                                                               | ✅                | ✅                | —                      |
| Dashboard admin senza stile Nebula                                                                                                                                                                             | ✅                | ✅                | ✅                     |

Screenshot generati in `test-results/screenshots/` (non versionati).

### Difetti trovati dai test e corretti

1. **Etichette duplicate** nel selettore titoli: campo, filtro e lista avevano lo stesso nome accessibile. Ora sono distinti.
2. **Feature montate sulla pagina precedente** quando `hashchange` e `viewshow` arrivano nello stesso frame. Corretto in `lifecycle.ts`, con test di regressione che fallisce sul codice vecchio.
3. **Rail della home cancellate** dal ridisegno nativo (`homesections.js` usa `innerHTML`). Ora c'è un observer limitato ai figli diretti, con test di regressione.
4. **Logo doppio** (Biaflix + icona Jellyfin) nella navbar. Ora c'è un solo logo.
5. **Controlli duplicati** nell'hub: la toolbar nativa «Nuova collezione» e i filtri agivano sulla griglia nascosta. Ora la toolbar è nascosta in modalità hub e visibile in «Vista classica».

### Revisione avversariale del codice (corretti, con test dove praticabile)

6. Frame già in coda dopo `Lifecycle.stop()`: poteva rimontare feature con l'utente precedente dopo un cambio utente. Ora `stop()` annulla il frame (test).
7. Pila dei dialog: ESC chiudeva anche il dialog sottostante (test); il dialog chiuso rubava il focus a quello nuovo.
8. Conferme distruttive con focus iniziale su «Annulla», non su «Elimina» (test).
9. Errore su descrizione/cover dopo la creazione: prima riapriva il form (rischio duplicati), ora avvisa e prosegue.
10. Teardown: i dialog aperti vengono chiusi davvero (listener inclusi).
11. Avvio fallito: nuovo tentativo al cambio pagina successivo, solo se la skin è ancora attiva.
12. Rail esclusa per utenti senza permessi che non ricompare; «nessun risultato» aggiornato al cambio filtro; rilevamento skin anche sul cambio di `data-skin`.

## Non verificato in questa fase

- Integrazione **live** con KefinTweaks/JE installati: l'istanza locale non ha i plugin. È verificata a livello di sorgente (tag esatti) e simulata nell'E2E per lo Skin Manager.
- Seerr, Sonarr, Radarr, Intro Skipper: richiedono l'ambiente di produzione o un'installazione dei plugin in locale.
- Safari/iOS, Android WebView, client desktop.
- LCP/CLS misurati su dati reali (i media sintetici non sono rappresentativi).

## Checklist di produzione

Da eseguire dopo `install.md` §5, su Firefox (obbligatorio) e almeno un mobile. ☐ = da spuntare.

- ☐ Film MKV e MP4: Riproduci da hero, card e dettagli; Riprendi dalla posizione salvata
- ☐ Episodio: Skip Intro (Intro Skipper), anteprima episodi, cambio audio/sottotitoli, scelta versione
- ☐ Fullscreen, pause screen JE, bookmark (se attivati)
- ☐ Ricerca: risultati libreria + gruppo Seerr una sola volta; richiesta da utente non admin con esito
- ☐ Nessun link Sonarr/Radarr visibile a un non admin
- ☐ Watchlist: aggiungi da card/dettagli, presente in «La mia watchlist», stessa lista su un secondo dispositivo; sync Seerr invariato
- ☐ Raccolta mista creata da un account con «Gestione raccolte»; visibile da un secondo account
- ☐ Un solo hamburger, un solo pulsante «casuale», un solo hero
- ☐ Dashboard e impostazioni plugin con aspetto nativo
- ☐ Console senza nuovi errori su home, dettagli, player, raccolte
- ☐ Rollback livello 1 provato su un browser
