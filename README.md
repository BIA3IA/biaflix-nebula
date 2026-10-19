# Biaflix Nebula

Skin originale, **dark-only** e cinematografica per **Jellyfin Web 12.2**: glassmorphism immersivo, identità viola → blu → ciano del logo Biaflix, homepage con hero e rail editoriali, **raccolte miste film + serie** salvate davvero sul server Jellyfin.

## Cosa fa

| Area      | Implementazione                                                                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aspetto   | `nebula.css`: token, navbar flottante glass, card 2:3/16:9 con lift e glow tenue, dettagli, player, ricerca, compatibilità plugin, responsive, reduced motion/transparency. La dashboard admin resta nativa.    |
| Homepage  | hero cinematografico da dati reali (raccolta «In evidenza», poi titoli in corso e ultimi aggiunti), rail «Le mie raccolte» e «La mia watchlist» inserite tra le sezioni native/KefinTweaks senza duplicarle     |
| Raccolte  | creazione con ricerca multi-selezione film+serie, «Aggiungi a…» da card e dettagli, gestione (aggiungi/rimuovi con conferma/elimina), hub su `#/boxsets` e `#/playlists`, filtro Film/Serie, collage automatico |
| Playlist  | creazione privata/pubblica, aggiunta da «Aggiungi a…». Riordino e rimozione restano nella pagina playlist nativa/KefinTweaks                                                                                    |
| Watchlist | `UserData.Likes`, la stessa fonte di Jellyfin Enhanced (sync Seerr) e KefinTweaks; distinta dai Preferiti                                                                                                       |
| Playback  | i pulsanti Nebula passano per i gestori nativi (`emby-itemscontainer` → playbackManager): nessun player riscritto                                                                                               |

Tutte le mutazioni usano le API ufficiali di Jellyfin 12.2 con la sessione dell'utente: nessuna API key, nessun proxy, nessuna persistenza in `localStorage`.

## Architettura

```text
src/
  styles/        token + fogli per area → dist/nebula.css (lightningcss)
  scripts/       TypeScript → dist/nebula.js (esbuild, IIFE)
    main.ts          guardia anti-reiniezione, attivazione legata alla skin, cambio utente, disable()
    skin-detect.ts   <link data-kefin-skin data-skin="Biaflix Nebula"> (observer solo su <head>)
    lifecycle.ts     mount/unmount idempotenti per route (viewshow + hashchange)
    jellyfin-api.ts  client tipizzato (firme verificate sull'OpenAPI 12.2)
    collections.ts   raccolte: mutazioni serializzate + verifica post-scrittura
    playlist.ts, watchlist.ts, cards.ts, images.ts, flags.ts, i18n.ts
    features/        hero, home-rails, details, collections-hub, card-actions, dialoghi
    ui/              dialog accessibile, toast, rail, selettore titoli, pulsante watchlist
  assets/        logo Biaflix (fonte unica)
dev/             Jellyfin 12.2 locale in Docker + media sintetici + seed
tests/unit       Vitest
tests/e2e        Playwright (Firefox, Chromium, mobile)
docs/            SPEC, audit plugin, install, rollback, compatibilità, QA, screenshot
```

**Attivazione:** il CSS è una skin dello **Skin Manager di KefinTweaks** e viene caricato solo quando è selezionata. Il JS arriva da uno snippet **JS Injector** e resta inerte finché la skin Nebula non è attiva. Nessun file core di Jellyfin viene modificato.

## Comandi

```bash
pnpm install
pnpm build          # dist/nebula.css, dist/nebula.js, dist/js-injector-snippet.js, dist/assets/
pnpm check          # typecheck + stylelint + unit + build
pnpm dev:up && pnpm dev:seed   # Jellyfin 12.2 locale su 127.0.0.1:8097
pnpm dev:plugins                # stessi plugin della produzione (KefinTweaks, JE, JS Injector…)
bash dev/enrich-media.sh && node dev/people-images.mjs   # dati realistici per la pagina dettagli
pnpm test:e2e
```

## Documentazione

- [docs/SPEC.md](docs/SPEC.md): specifica di prodotto
- [docs/plugin-audit.md](docs/plugin-audit.md): versioni e configurazione reali (Fase 0)
- [docs/install.md](docs/install.md): rollout reversibile in produzione
- [docs/rollback.md](docs/rollback.md): ritorno a ElegantFin in pochi clic
- [docs/compatibility.md](docs/compatibility.md): client, plugin, limiti
- [docs/QA.md](docs/QA.md): test, risultati, checklist di produzione
- [CHANGELOG.md](CHANGELOG.md)

## Licenza

Codice MIT ([LICENSE](LICENSE)). Il logo Biaflix è proprietario ed escluso dalla licenza.
