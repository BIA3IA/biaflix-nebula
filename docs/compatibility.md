# Compatibilità e limiti

## Client

| Client                                                           | Supporto                | Note                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jellyfin Web 12.2, layout **Modern**, Firefox/Chromium desktop   | ✅ completo             | testato E2E (Firefox 1920×1080, Chromium 1366×768)                                                                                                                                                                    |
| Jellyfin Web 12.2, mobile (browser)                              | ✅ completo             | testato E2E 390×844; header compatto, hero 60svh, dialog a foglio dal basso                                                                                                                                           |
| Jellyfin Web, layout **Legacy** (desktop-legacy/mobile-legacy)   | ⚠️ best effort          | palette, card, dettagli e player stilizzati; navbar glass sull'header storico; le route `#/boxsets`/`#/playlists` non esistono in legacy, quindi niente hub (raccolte comunque gestibili da dettagli e «Aggiungi a…») |
| Jellyfin Media Player / client desktop che caricano Jellyfin Web | ⚠️ probabile            | caricano gli stessi CSS/JS del server; non testato                                                                                                                                                                    |
| App Android/iOS che incorporano Jellyfin Web                     | ⚠️ probabile            | come sopra; la scelta della skin è per dispositivo                                                                                                                                                                    |
| App native (Android TV, Roku, Swiftfin, Findroid, Infuse, TV)    | ❌ non applicabile      | non caricano Jellyfin Web: nessuna skin, ma media, raccolte, playlist e watchlist funzionano perché sono dati server                                                                                                  |
| Dashboard amministrazione                                        | ⛔ esclusa di proposito | `body.dashboardDocument` non riceve palette né stili Nebula (verificato E2E)                                                                                                                                          |

## Plugin

| Plugin                                | Versione  | Integrazione                                                                                                                                                                                          |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KefinTweaks                           | 0.5.1     | Skin Manager (attivazione), sezioni home (ordinamento `order`), hamburger, ricerca, modali: solo stile. **Non** fissare Nebula a selettori interni oltre a quelli documentati in `plugin-compat.css`. |
| Jellyfin Enhanced                     | 12.12.0.0 | watchlist condivisa (`Likes`), Seerr search (unico presenter), header tray, pause screen, tag: solo stile, posizioni invariate                                                                        |
| CustomTabs                            | —         | nessuna tab configurata; stile compatibile se aggiunte                                                                                                                                                |
| Plugin Pages                          | 3.0.2.0   | pagine JE servite da Plugin Pages ereditano palette e superfici                                                                                                                                       |
| Intro Skipper, InPlayerEpisodePreview | —         | player non modificato oltre ai colori dei controlli                                                                                                                                                   |

## Pagina dettagli (v0.2.0)

Il controller nativo di jellyfin-web resta il proprietario della pagina: Nebula aggiunge hero, stagioni ed episodi, informazioni, cast e suggerimenti, e **nasconde soltanto** con CSS le sezioni native sostituite (`#childrenCollapsible`, `#listChildrenCollapsible`, `.nextUpSection`, `#castCollapsible`, `#guestCastCollapsible`, `#similarCollapsible`, `.moreFromSeasonSection`, e `.series-episodes-section` di KefinTweaks). Le azioni passano per i pulsanti nativi (attivati per delega), quindi aggiornamenti di Jellyfin o dei plugin che aggiungono pulsanti compaiono automaticamente in «Altre azioni».

Tipi gestiti: Film, Serie, Stagione, Episodio, Raccolta. Le altre pagine (persone, musica, live TV) restano native con lo stile Nebula.

## Calendario Jellyfin Enhanced

`src/styles/calendar.css` uniforma il calendario JE 12.12 ai token Nebula: toolbar su due righe senza posizionamento assoluto, controlli da almeno 44px, stati attivi con gradiente, filtri glass e agenda raggruppata per data. Le viste giorno/settimana/mese mantengono i renderer e i colori semantici degli eventi del plugin. La dashboard resta esclusa.

Selettori verificati sui moduli locali `calendar-page-styles.js`, `calendar-page-render-views.js` e `calendar-page-render-events.js`. Gli override `!important` sono limitati al padding inline della pagina dedicata e ai colori che JE inietta a sua volta con `!important`. Non vengono sostituiti nodi, gestori delle azioni o fonti dati.

I test usano la pagina dedicata e il renderer reale con risposte sintetiche per calendario/user-data/richieste; non richiedono Sonarr/Radarr. Native Tab e Plugin Pages condividono le classi stilizzate, ma i loro percorsi di navigazione non sono coperti dalla nuova suite. Safari/iOS e touch fisico restano da verificare.

## Correttivi per difetti di plugin terzi (da rimuovere quando corretti a monte)

| Plugin                  | Difetto                                                                                                        | Correttivo Nebula                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Jellyfin Enhanced 12.12 | Con «Use Icons» spento `JE.icon()` restituisce '' e `JE.t()` rimette il segnaposto `{{icon:…}}` nei testi      | `src/scripts/compat/je-icon-tokens.ts` avvolge `JE.t` e toglie i token rimasti; in alternativa basta attivare «Use Icons» in JE |
| Jellyfin Enhanced 12.12 | Righe Studi/Network: doppie frecce, quelle di JE usano `scrollBy` su uno scroller a transform e non funzionano | `plugin-compat.css` nasconde solo le frecce JE quando la riga ha quelle native                                                  |
| jellyfin-web 12.2       | Scroller a transform senza ritaglio su desktop → scroll orizzontale del documento                              | `rails.css`: ritaglio come nel layout TV                                                                                        |
| KefinTweaks 0.5.1       | Pillola categorie con classi MUI dell'AppBar (fissa sul bordo)                                                 | `plugin-compat.css`: posizionamento con `!important` limitato                                                                   |

## Limiti noti (non aggirabili lato client)

1. **Le raccolte sono globali.** Jellyfin non ha raccolte private per account: una raccolta è visibile a tutti gli utenti che vedono i titoli contenuti. Nebula lo dichiara nei dialog. Per liste personali usa le **playlist** (private di default, pubblicabili). Una raccolta davvero privata richiederebbe un backend dedicato (spec §7), da approvare prima.
2. **Creare e modificare raccolte richiede il permesso «Gestione raccolte».** Senza permesso, Nebula non mostra i controlli e il server risponde comunque 403.
3. **Descrizione e cover caricata di una raccolta: solo admin** (`RequiresElevation` su 12.2). Per gli altri c'è il collage automatico dei poster, generato al volo e non salvato.
4. **Playlist e serie:** aggiungere una serie a una playlist inserisce tutti i suoi episodi (comportamento server 12.2). Nebula lo avvisa nel dialog.
5. **Skin per browser, non per utente:** KefinTweaks 0.5.1 salva la skin scelta in `localStorage`. Due utenti sullo stesso browser condividono la scelta.
6. **Pagina hub raccolte** solo sul layout Modern (`#/boxsets`, `#/playlists`), che in Jellyfin esiste solo dopo la creazione della prima raccolta. Prima di allora la creazione parte dalla rail «Le mie raccolte» in home.
7. **Hero:** usa la raccolta curata «In evidenza» se esiste (nome configurabile in `heroCollectionName`), altrimenti film in corso e ultimi aggiunti con backdrop. Lo Spotlight KefinTweaks, se configurato, resta come sezione editoriale sotto l'hero.
8. **Font:** system-first, nessun font esterno.

## Aggiornamenti futuri

- **Jellyfin Web:** i selettori MUI usati sono le classi stabili (`MuiAppBar-root`, `MuiToolbar-root`, `MuiButton-root`) e le variabili `--jf-palette-*`; nessuna classe hash `css-*`. Dopo ogni aggiornamento rilanciare `pnpm test:e2e` contro un'istanza locale della nuova versione (`IMAGE` in `dev/up.sh`).
- **KefinTweaks:** fissare il tag in JS Injector. Le API usate sono il `<link data-kefin-skin data-skin>` e l'evento implicito di ridisegno della home (gestito con un observer circoscritto).
- **Jellyfin Enhanced:** Nebula non dipende dal suo JS; solo da classi CSS documentate in `plugin-compat.css`.
