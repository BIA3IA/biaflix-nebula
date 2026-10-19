# Installazione di Biaflix Nebula (rollout reversibile)

> **Nessun passo va eseguito in produzione senza la tua approvazione esplicita.**
> Nessun passo tocca TrueNAS, NFS, Proxmox, le librerie, gli utenti o i plugin oltre a: Branding CSS, config KefinTweaks (skin) e un nuovo script JS Injector.
> Non serve riavviare Jellyfin né il container LXC 104.

Tempo stimato: 15–20 minuti. Rollback: 1–2 minuti (vedi [rollback.md](rollback.md)).

## Cosa viene installato

| Pezzo                              | Dove                                          | Effetto                                                                   |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `dist/nebula.css` + `dist/assets/` | URL versionato (GitHub + jsDelivr, tag fisso) | aspetto Nebula, caricato **solo** se la skin è selezionata                |
| skin «Biaflix Nebula»              | KefinTweaks → Skin Manager → Skins JSON       | voce selezionabile accanto a ElegantFin                                   |
| `dist/js-injector-snippet.js`      | JS Injector, script pubblico «Biaflix Nebula» | carica `nebula.js`, che si attiva **solo** con la skin Nebula selezionata |

## 0. Prerequisiti

1. **Pubblicare gli asset con un tag fisso** (azione tua: richiede push e release su GitHub).
   - Repository consigliato: `github.com/<tuo-utente>/biaflix-nebula`, tag `v0.1.0`.
   - URL risultanti (mai `@latest` o `@main`):
     - `https://cdn.jsdelivr.net/gh/<tuo-utente>/biaflix-nebula@v0.1.0/dist/nebula.css`
     - `https://cdn.jsdelivr.net/gh/<tuo-utente>/biaflix-nebula@v0.1.0/dist/nebula.js`
   - Il CSS carica il logo da `dist/assets/` con URL **relativi**: la cartella deve stare accanto a `nebula.css`.
2. **Conferma del logo**: `src/assets/biaflix-logo.png` è il candidato trovato in `~/Downloads` («Glossy Neon Gradient B Logo.png»). Va confermato prima del rilascio (vedi [../src/assets/README-logo-source.md](../src/assets/README-logo-source.md)).
3. `pnpm install && pnpm check && pnpm test:e2e` verdi (vedi [QA.md](QA.md)).

## 1. Export manuale prima di ogni modifica (nessun job programmato)

1. **Branding CSS**: copiare il testo attuale in un file locale. La copia è già in [plugin-audit.md](plugin-audit.md#stile-attivo-oggi).
2. **KefinTweaks**: Dashboard → KefinTweaks → _Export configuration_ (funzione ufficiale) → salvare il JSON.
3. **JS Injector**: annotare nome, ordine e stato (on/off) degli script esistenti (`kefin`, `KefinTweaks-Config`, `KefinTweaks-injector`).
4. Fare uno screenshot di Home, Dettaglio film, Dettaglio serie, Ricerca e Player con la skin attuale.

## 2. Registrare le skin nello Skin Manager (nessun effetto visibile per gli utenti)

Dashboard → KefinTweaks → **Skin Manager** → _Skins JSON_. Incollare il blocco seguente sostituendo `<tuo-utente>`:

```json
[
  {
    "name": "Biaflix Nebula",
    "author": "Biaflix",
    "url": [
      {
        "majorServerVersions": [12],
        "urls": ["https://cdn.jsdelivr.net/gh/<tuo-utente>/biaflix-nebula@v0.1.0/dist/nebula.css"]
      }
    ],
    "colorSchemes": []
  },
  {
    "name": "ElegantFin",
    "author": "lscambo13 (configurazione Biaflix attuale)",
    "url": [
      {
        "majorServerVersions": [12],
        "urls": [
          "https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/ElegantFin-jellyfin-theme-build-latest-minified.css",
          "https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks@v0.5.1/skins/elegant-kefin.css",
          "https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks@v0.5.1/skins/elegant-kefin-10.11.css",
          "https://cdn.jsdelivr.net/gh/ranaldsgift/KefinTweaks@v0.5.1/skins/fin-kefin-10.11.css",
          "https://cdn.jsdelivr.net/gh/lscambo13/ElegantFin@main/Theme/assets/add-ons/media-bar-plugin-support-latest-min.css",
          "https://cdn.jsdelivr.net/gh/mihaif7/elegantfin-jf12@main/Theme/ElegantFin-jf12-modern-latest.css"
        ]
      }
    ],
    "colorSchemes": []
  }
]
```

Perché due voci:

- **Biaflix Nebula** è la nuova skin.
- **ElegantFin**, con lo stesso nome, sostituisce la definizione integrata di KefinTweaks: lo Skin Manager rimpiazza per nome. Contiene **esattamente** l'insieme di fogli caricato oggi, cioè gli `@import` del Branding più i fogli della skin integrata. Chi resta su ElegantFin non vede differenze, e ElegantFin diventa alternativo a Nebula invece di sovrapporsi.

Salvare. `defaultSkin` resta `ElegantFin`.

## 3. Aggiungere lo script JS Injector (inerte finché nessuno sceglie Nebula)

Dashboard → JavaScript Injector → _Add script_:

- **Nome:** `Biaflix Nebula`
- **Pubblico:** sì (si attiva solo dopo il login, quando trova la sessione)
- **Contenuto:** il file `dist/js-injector-snippet.js`, con `NEBULA_JS_URL` impostato all'URL del punto 0.
- **Ordine:** dopo gli script KefinTweaks.

Lo snippet è idempotente (non carica due volte `nebula.js`) e contiene `window.BiaflixNebulaConfig` con i feature flag (hero, rail, quick action, hub, autoplay disattivato…).

## 4. Prova su un solo browser (nessun impatto sugli altri)

La scelta della skin in KefinTweaks 0.5.1 è salvata **per browser** (`localStorage.kefinTweaks_selectedSkin`), non per utente.

1. Su Firefox desktop: icona **Aspetto** (tavolozza) nella barra in alto, oppure _Impostazioni → Schermo → Skin_, e scegliere **Biaflix Nebula**.
2. Il Branding CSS contiene ancora ElegantFin: in questa fase **vedrai i due temi sovrapposti**. È atteso, e il punto 5 lo risolve. Per una prova pulita prima del punto 5, usa un'istanza di test (`pnpm dev:up`).

## 5. Cutover del Branding CSS (dopo l'ok dalla prova)

Dashboard → Generale → **Branding → Custom CSS**: rimuovere **solo** i tre `@import` di ElegantFin e lasciare le due regole `.je-recommendations-title`:

```css
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

Effetto: chi ha ElegantFin selezionato (default) lo riceve dallo Skin Manager con gli stessi fogli; chi sceglie Nebula riceve solo Nebula.

> **Custom CSS per utente:** se un account ha CSS personale (Impostazioni → Schermo → CSS personalizzato) con import di temi, va rimosso da quell'account per evitare sovrapposizioni. Non è verificabile senza accedere come quell'utente.

## 6. Verifiche post-cutover (checklist in [QA.md](QA.md#checklist-di-produzione))

Riproduzione MKV/MP4, ripresa, sottotitoli/audio, Skip Intro, ricerca con Seerr, richiesta da non-admin, watchlist, creazione raccolta mista con un account con permesso «Gestione raccolte».

## 7. (Opzionale, solo dopo l'approvazione) Nebula come predefinita

KefinTweaks → Skin Manager → **Default skin** = `Biaflix Nebula`. Vale per i browser che non hanno mai scelto una skin; chi ha già scelto ElegantFin lo mantiene.

## Raccolte: prerequisiti di sicurezza

Prima di creare raccolte curate in produzione (vedi spec §0):

- verificare che `/mnt/media` sia montato nel container 104;
- in Dashboard → Attività pianificate, controllare i trigger di **«Clean up collections and playlists»** (in alcune versioni parte all'avvio del server): se gira con il mount assente può svuotare le playlist. Nebula non avvia mai task né scansioni;
- per permettere a un account non admin di creare raccolte serve il permesso **«Gestione raccolte»** (`EnableCollectionManagement`) nel profilo utente. È una modifica ai permessi: decidila tu.
