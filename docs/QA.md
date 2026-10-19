# QA

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

Screenshot in [`docs/screenshots/`](screenshots/).

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
