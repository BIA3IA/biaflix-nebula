# BIAFLIX NEBULA — SPECIFICA PRODOTTO & IMPLEMENTAZIONE

**Versione specifica:** 1.0 — 19 ottobre 2026  
**Lingua UI:** italiano come lingua primaria; predisporre i18n inglese  
**Stato:** specifica pronta per analisi tecnica e implementazione incrementale; le impostazioni *attive* dei plugin devono essere censite prima di cambiare alcunché.  
**Committente:** proprietaria di Biaflix  
**Destinatario:** agente sviluppatore incaricato di realizzare una skin/UI effettivamente funzionante per Jellyfin Web 12.x.

> **Mandato all'agente.** Realizza Biaflix Nebula come tema originale, dark-only, con glassmorphism immersivo e identità viola/blu/ciano coerente con il logo Biaflix esistente. Non consegnare soltanto screenshot, una pagina HTML statica o il restyling di ElegantFin: consegna codice funzionante, integrazione verificata con Jellyfin 12 e plugin, test, istruzioni di installazione e rollback. Non disattivare o modificare plugin e dati in produzione senza inventario, test e autorizzazione. Non alterare NFS, TrueNAS, i media, Proxmox o la rete.

## 0. CONTESTO REALE / VINCOLI DI SICUREZZA

- Jellyfin gira nel **container LXC 104** del nodo Proxmox `bia3ia` (9.2.21); accesso LAN `http://192.168.1.3:8096`, accesso pubblico esistente `biaflix.bia3ia.com` tramite Cloudflare Tunnel LXC 102.
- Storage media fornito dalla VM TrueNAS 100 su `192.168.1.102`, export NFS `192.168.1.102:/mnt/catPool/netflix`, montato nel container Jellyfin su `/mnt/media`.
- Il mount NFS in passato mancava e FFmpeg non trovava i file; la configurazione di avvio è stata corretta e la riproduzione funziona. **Non interferire con il mount, i servizi systemd, i path o le scansioni della libreria.**
- Il vecchio container **101** è una copia di sicurezza temporanea: non spegnerlo, avviarlo, cancellarlo o modificarlo senza autorizzazione. La produzione è **104**.
- LXC 105 Tailscale fornisce accesso VPN alla rete `192.168.1.0/24`; non usarlo per ospitare UI o asset senza necessità.
- La proprietaria non desidera backup automatici. Sono ammessi export manuali delle configurazioni e copie manuali delle sole risorse modificate prima del deploy; non attivare job programmati.
- Plugin visibili/installati nei materiali: **Jellyfin Enhanced**, **KefinTweaks**, **JS Injector**, **File Transformation**, **Intro Skipper**; altri eventuali plugin vanno inventariati. Sono presenti connessioni **Seerr, Sonarr, Radarr e TMDB** nell'Overview Jellyfin Enhanced.
- Da un precedente screenshot, la skin predefinita è **ElegantFin**; non sovrapporre ElegantFin e Nebula. Il logo Biaflix esiste già: **riutilizzare l'asset originale in alta risoluzione, da richiedere/rintracciare in modo autorizzato, non sostituirlo con una nuova B inventata**.
- Versioni di riferimento della documentazione: Jellyfin 12.x (dal log web mostrato Jellyfin Web 12.2.0), Jellyfin Enhanced **12.12.0.0** (release 11/10/2026). Prima di codificare registrare versioni realmente installate di server/web/plugin e commit/tag delle dipendenze. Non presumere che la versione vista online sia installata.

### Attenzione critica alle collezioni e allo storage

La documentazione Jellyfin avverte che la task `Clean up collections and playlists`, se eseguita con media di rete non disponibili, può svuotare playlist; in alcune versioni si avvia all'avvio del server. **Prima di introdurre raccolte curate, verificare trigger, comportamento sulla versione installata e salute del mount NFS.** La UI deve mostrare stato indisponibile, non trattare i contenuti momentaneamente assenti come rimossi. Non avviare scansioni di libreria né task di cleanup mentre `/mnt/media` non è montato.

## 1. VISIONE E PRINCIPI

**Nome:** Biaflix Nebula  
**Personalità:** cinematografica, sofisticata, immersiva, personale, ordinata, non un clone di Netflix e non una dashboard tecnica.  
**Direzione:** fondo quasi nero bluastro, gradiente viola elettrico → blu intenso → accenti ciano derivati dal logo, superfici in vetro scuro stratificate, forte qualità delle artwork, animazioni fluide e discrete.  
**Tema:** esclusivamente scuro; vietati light mode, sfondi bianchi e luci stroboscopiche.  
**Regole:** contenuto prima dei controlli; immagine nitida, vetro dietro la UI e non davanti ai poster; ogni azione visibile deve funzionare; compatibilità con tastiera e touch; nessuna dipendenza da un singolo CSS di terzi.

**Non-obiettivi:** riscrivere il media server, fare transcoding, cambiare config di TrueNAS, sostituire Seerr/Sonarr/Radarr, modificare autonomamente utenti e permessi, installare nuove VPN, importare contenuti illeciti, creare un fork massiccio di Jellyfin Web senza motivazione.

### Criteri di qualità visiva

- Presenza premium in 1440p e 1080p; interfaccia utilizzabile a 1366×768, tablet, mobile.
- Colori speciali solo sui punti focali (Play, progress, focus, selezione); evitare glow costante su tutta la pagina.
- Evitare sovrapposizioni come quelle visibili nella navbar attuale (testo/logo sopra i backdrop senza sufficiente contrasto).
- I metadati non devono ricoprire artwork importanti o nascondere testo dei titoli.

## 2. DESIGN TOKENS (VALORI INIZIALI DA TESTARE)

Tutti i valori devono stare in token CSS e non ripetersi hard-coded nei componenti.

```css
:root {
  --nebula-bg: #080b16;
  --nebula-bg-elevated: #111629;
  --nebula-surface: #171c31;
  --nebula-text: #f6f6ff;
  --nebula-text-muted: #a8aec3;
  --nebula-primary: #854bff;
  --nebula-primary-light: #b16dff;
  --nebula-blue: #476dff;
  --nebula-cyan: #39d4e8;
  --nebula-danger: #ff657f;
  --nebula-success: #53d8a3;
  --nebula-gradient: linear-gradient(120deg,#854bff 0%,#476dff 54%,#39d4e8 100%);
  --nebula-glass-bg: rgba(14,19,37,.62);
  --nebula-glass-strong: rgba(10,14,28,.82);
  --nebula-glass-border: rgba(213,218,255,.18);
  --nebula-glass-highlight: rgba(255,255,255,.09);
  --nebula-blur: 26px;
  --nebula-radius-sm: 10px;
  --nebula-radius-md: 16px;
  --nebula-radius-lg: 22px;
  --nebula-radius-xl: 28px;
  --nebula-nav-height: 68px;
  --nebula-content-max: 1680px;
  --nebula-content-gutter: clamp(16px,4.5vw,72px);
  --nebula-fast: 160ms;
  --nebula-normal: 240ms;
  --nebula-slow: 520ms;
  --nebula-ease: cubic-bezier(.2,.8,.2,1);
}
```

**Glass immersivo:** `backdrop-filter: blur(20–32px) saturate(130%–155%)` per navbar, dropdown, drawer, modal e overlay; bordo translucido 1px; piccola luce superiore; shadow soffusa. Fallback opaco qualora `backdrop-filter` non sia supportato o il dispositivo sia debole. Non sfocare indiscriminatamente gli sfondi delle locandine e il player. Non rendere il testo traslucido.

**Tipografia:** system-first con eventuale font locale/licenziato; heading distintivo ma leggibile, peso 600/700, line-height 1.1–1.25; corpo 14–16px, metadati 12–14px; testi lunghi limitati a ~60–75 caratteri per riga. Iconografia coerente (Lucide o set esistente, senza miscelare set incongruenti). Nessun font esterno obbligatorio.

**Spaziatura:** scala 4/8/12/16/24/32/48/64px; almeno 24px tra contenitori di sezioni; sezioni desktop 38–56px verticali; padding responsivo. Ombre e gradienti devono dare profondità, senza effetto «neon gaming».

**A11y:** contrasto WCAG AA per testi/controlli, indicatore focus viola/ciano netto, target touch ≥44×44px, labels assistive tech, `prefers-reduced-motion`, respect `prefers-reduced-transparency` quando disponibile, no hover-only interactions.

## 3. ARCHITETTURA DELL'INFORMAZIONE / NAVIGAZIONE

### Navbar desktop

- Barra floating glass centrata con margine superiore 14–20px e laterali; max-width compatibile con layout; altezza ~68px; z-index corretto sopra hero, sotto le modali.
- **Sinistra:** hamburger *solo se realmente utile* per drawer completo, logo Biaflix originale senza ritaglio o deformazione.
- **Centro:** Home, Film, Serie TV, Anime (solo se categoria/libreria presente o filtro attendibile), Collezioni.
- **Destra:** ricerca, Watchlist, richieste Seerr (se configurate), profilo. Evitare notifiche inesistenti o icone decorative senza azione.
- Sticky in scroll: background leggermente più scuro e ombra più solida; niente lampeggi o salti di layout. Active indicator viola, focus visibile, tastiera funzionante.
- Se KefinTweaks fornisce già i menu, scegliere **una sola implementazione del drawer**. Non creare due hamburger menu o due pulsanti Random.

### Mobile / tablet

- Header compatto con logo, search e profilo; hamburger o bottom navigation con max 4–5 destinazioni principali. Menu accessibile via touch e tastiera, safe areas per dispositivi con notch.
- Hero 55–65svh con testo leggibile, massimo 2 CTA; sezioni in carousels swipe-safe e card non minuscole.
- Niente hover-only, no autoplay trailer, no glass che impedisca la leggibilità.

### Route richieste

`/home`, `/movies`, `/shows`, `/anime` (se disponibile), `/collections`, `/playlists`, `/watchlist`, `/search`, `/requests` (se Seerr on), pagine dettagli film/serie/episodio, profilo. **Non inventare rotte che Jellyfin non possiede**: mappare gli stati e i link al router reale di Jellyfin 12 e alle pagine create dai plugin; preservare back/forward, refresh e deep linking.

## 4. HOMEPAGE — COMPOSIZIONE VINCOLANTE

Ordine consigliato, ma configurabile dal proprietario e dai plugin senza duplicare le sezioni:

1. **Floating navbar**, overlay sul contenuto.
2. **Cinematic Hero** 72–80svh desktop, 55–65svh mobile. Backdrop 16:9 o più ampio, sfumatura a sinistra e sotto. Scegliere contenuti *realmente presenti nella libreria*; fonte preferita: contenuti fissati da proprietario/KefinTweaks Spotlight; in assenza, elementi di libreria dotati di backdrop. Non confondere trailer esterni con media disponibile.
3. **Rail «Continua a guardare»** (priorità alta), card 16:9 con progress, serie/episodio e `Riprendi`.
4. **Rail «Prossimo episodio»** se esistono serie in corso, con immagine episodio, SxxExx, durata e spoiler guard quando attivo.
5. **Rail «Aggiunti di recente»**: poster 2:3 e date non invadenti; filtro film/serie se utile.
6. **Rail «Scelti da me» / «Le mie collezioni»**: card editoriali larghe 16:9 con cover composita e nomi creati dall'utente.
7. **Rail «Film» e «Serie TV»** come poster gallery curata; «Anime» se esiste biblioteca/criterio affidabile e non solo dal testo nel titolo.
8. **Rail «La mia watchlist»** usando un'unica fonte; se assente, CTA per aggiungere il primo titolo.
9. **«Scopri qualcosa» / Raccomandazioni** opzionale, da dati reali Jellyfin/KefinTweaks/Seerr, non valori inventati.
10. Niente footer invasivo.

**Quick actions:** non inserire obbligatoriamente una seconda barra di 6–8 pulsanti tra hero e contenuti: è ridondante rispetto alla navbar. Se utile, usare 2–3 chip glass contestuali (`Riprendi`, `Collezioni`, `Sorprendimi`) e nasconderli su mobile.

### Hero dettagliato

- Un solo titolo attivo con artwork cinematografica ad alta risoluzione, logo grafico del titolo se disponibile, altrimenti tipografia robusta.
- Sinistra: eventuale piccolo badge Featured (solo se davvero curato), titolo/logo, metadati (anno, durata, rating affidabile, generi), sinossi tagliata a 2–3 righe, CTA **Riproduci/Riprendi** primaria e **Dettagli** glass secondaria, Watchlist icon separata.
- Sfondo destra lasciato visibile, gradiente sinistra `#080b16` 90% → 0%, e sfumatura fondo verso contenuti.
- Se carousel: max 3–5 slide da dati reali, 8–12s solo se user-consented, stop al hover/focus/tab nascosta, navigazione manuale e indicatori discreti; default preferito = hero statico per ridurre distrazioni.
- Se nessun backdrop, usa gradient animato lievissimo + cover del film come accento; mai sfondo vuoto o titolo illeggibile.

### Rails

- Titoli sezione 20–26px, descrizione breve solo dove chiarisce; `Vedi tutti` vero link; rail scrollabile con snapping naturale e controlli desktop.
- Margini uguali, card con dimensione coerente e nessuna ultima card tagliata male; skeleton di dimensioni stabili (niente CLS).
- Non mostrare le sezioni vuote (tranne opzionale primo utilizzo); non mostrare duplicati per scelta «recents/next up» quando possibile; non attivare query ripetute a ogni scroll.

## 5. CARD / THUMBNAIL — PRIORITÀ ASSOLUTA

**Poster film e serie:** aspect ratio **2:3** (esempio desktop 190–230 × 285–345px), `object-fit: cover`, no allungamento, lazy loading e dimensione corretta per DPR; angoli 16–20px. Titolo e metadati normalmente *sotto* il poster oppure in overlay inferiore su hover/focus, ma non stampati sopra al centro dell'artwork. Se la cover contiene già un titolo, evitare sovrapporre una scritta gigantesca.

**Episodi / Continua a guardare:** **16:9** (es. 300×169), immagine dal thumbnail episodio; overlays con episodio e SxxExx, progress bar viola→ciano di 3–4px, percentuale o «restano X min» se affidabile. Tenere la thumbnail nitida e senza gradient permanenti eccessivi.

**Collezioni:** formato editoriale **16:9 o 3:2**, cover composta da poster selezionati (2–4) o cover scelta dall'utente; gradiente glass overlay su basso, nome, numero elementi e descrizione corta. Distinguere visivamente raccolte tematiche da playlist ordinate.

**Hover/focus desktop:** sollevamento -4px, scala 1.025–1.045 max, bordo glass leggero, glow viola *tenue* e backdrop sfumato. Overlay animato con Play, Aggiungi alla watchlist, Aggiungi alla collezione, Dettagli. Icone nel DOM solo quando necessarie ma navigabili da tastiera; non bloccare il click principale della card.

**Touch:** menu overflow o quick action button, long-press non essenziale. Swipe rails; tapping thumbnail apre dettagli o riprende solo dove etichettato chiaramente.

**Stati:** nuove aggiunte, guardati, in corso, non disponibili, placeholder per poster assente, caricamento, richiesta in elaborazione, errore di accesso. Badge pochi e veri (no «4K»/rating quando i dati mancano). Metadati/tag plugin devono poter essere visualizzati senza sovrapporsi al titolo/progress.

**Immagini:** usare API immagine Jellyfin e `ImageTags`/ID, scegliere `Primary`, `Backdrop`, `Thumb`, `Logo` secondo tipo; `srcset` o richieste coerenti con render size e DPR; caching robusto; degrado grazioso a placeholder Nebula; test immagini verticali, wide, titoli lunghi, poster scuri e molto chiari. Non scaricare poster da fonti esterne se Jellyfin li possiede già.

## 6. ALTRE SCHERMATE (NON SOLO HOMEPAGE)

### Dettaglio film

- Hero con backdrop cinematico, title/logo e overlay leggibile; azioni **Riproduci**, **Trailer** solo se disponibile, **Watchlist**, **Aggiungi a raccolta/playlist**, **Condividi** solo se supportato.
- Informazioni: anno, durata, rating con fonte, risoluzione/audio in panel compatto, lingua e sottotitoli; trama espandibile, cast con ritratti circolari, video/edizioni e versioni, contenuti simili, collezioni di appartenenza.
- Supportare Jellyfin Enhanced Media Tags, Spoiler Guard, Elsewhere/ratings senza overlay multipli e senza duplicare info.

### Dettaglio serie

- Hero coerente ma episodi centrali nell'esperienza; selettore stagione chiaro; episodi con thumbnail 16:9, descrizione oscurata se spoiler guard, progress, `Prossimo episodio` evidente.
- Compatibilità con **KefinTweaks Episodes on Series Page, Series Info+, Flatten Single Season Shows**, e con Intro Skipper: non sovrascrivere i controlli del player.

### Player

- Non riscrivere il motore di playback; restylare i controlli quando sicuro. Barra avanzamento 3–5px gradiente viola/ciano, scrubbing accessibile, glass dark solo sui controlli visibili, overlay auto-hide, subtitles ad alto contrasto.
- Non interferire con Jellyfin Enhanced Bookmarks/Pause Screen/PiP/Auto-Skip, Intro Skipper, scelta qualità, audio, sottotitoli, transcodifica hardware.
- Video mai offuscato da decorative blur. Supportare browser fullscreen e native clients senza presumerne le UI modificabili.

### Ricerca

- Pulsante e scorciatoia tastiera (solo se non confligge con quelle registrate da Enhanced); pannello glass o route completa, input focalizzato, filtri contenuto, risultati Jellyfin separati dai titoli richiedibili tramite Seerr.
- Se JE e KefinTweaks integrano entrambi Seerr, **una sola fonte/renderizzazione per gruppo risultati**; nessuna duplicazione. Rispetta diritti e status della richiesta.

### Watchlist

- Fonte dati da stabilire con un audit: KefinTweaks implementa watchlist separata dai Favorites, sfruttando `UserData Likes`; Jellyfin Enhanced può sincronizzarla con Seerr. Non trattare Favorite e Watchlist come sinonimi.
- `Aggiungi/Rimuovi watchlist` coerente su hero, card, dettagli e ricerca; conteggio, error handling, sincronizzazione tra browser e web client; nessuna finta icona a cuore senza mutazione reale.

### Login, profilo, settings

- Logo Biaflix e dark styling coerente dove il client Web lo permette; layout responsivo, messaggi di errore leggibili; no gestione password custom.
- Mantieni accessibili schermate admin/plugin con CSS normale (non cercare di ridisegnare tutta la dashboard nativamente fuori dalle API). L'admin potrebbe non ricevere CSS personalizzato in Jellyfin 12: documentare limitazione e non forzare hack fragili.

## 7. RACCOLTE, COLLEZIONI, PLAYLIST — FUNZIONALITÀ CHIAVE

La proprietaria vuole creare selezioni *personali* anche **miste film + serie**, non soltanto consultare i «box set» automatici.

### Concetti da mostrare chiaramente

- **Collezione / Raccolta tematica:** gruppo editoriale (es. «Serata Halloween», «Fantasy», «Comfort Movies») senza obbligo di autoplay sequenziale. Usare **Collections/BoxSets native Jellyfin** quando permessi e compatibilità consentono di includere film e serie. Sono potenzialmente condivise/globali: l'agente deve testare visibilità e permessi su Jellyfin 12 e non promettere privacy personale dove non esiste.
- **Playlist:** lista ordinata di contenuti riproducibili con `Play all`, `Shuffle`, riordino e possibilità di modificare elementi. Usare Playlist API di Jellyfin. Verificare con prove concrete quali tipi di item (serie intere, stagioni, episodi) si possano inserire/riprodurre: le serie come contenitori possono richiedere navigazione o espansione in episodi, non dare per scontato che «Riproduci tutta la serie» sia consentito in ogni playlist.
- **Watchlist:** lista personale «voglio vedere», fonte KefinTweaks/JE, indipendente da Favorite.

### UX richiesta

- Pagina **Collezioni** con griglia di cover editoriali, filtro `Tutte / Le mie / Playlist` solo se esistono veri dati e permessi per distinguerle; `+ Nuova raccolta` se consentito.
- Dialog **Crea raccolta**: nome obbligatorio, descrizione facoltativa, cover manuale o collage automatico, campo ricerca multi-selezione per **film e serie**, selezione/anteprima elementi, conferma e feedback riuscita/errori.
- Da ogni film/serie: menu `Aggiungi a…` → raccolta esistente / `Crea nuova`, e azioni speculari di rimozione. Evitare mutazioni distruttive senza conferma.
- Pagina raccolta: cover widescreen, titolo, breve descrizione, numero elementi, griglia mista poster 2:3, filtri Movie/Series, ordina se disponibile, gestione/reorder solo per ruolo autorizzato.
- Playlist: ordine esplicito drag & drop o pulsanti accessibili, `Riproduci tutti` solo per elementi supportati; duplicati gestiti secondo semantica Jellyfin.
- Aggiornamento reale nel backend: dopo reload, su altro browser e per gli utenti autorizzati devono esistere ancora. **Non usare soltanto localStorage per la persistenza**.

### Architettura dati / API

Usare API ufficiali Jellyfin / SDK autenticato dell'utente, con `CollectionApi.createCollection`, endpoint di aggiunta/rimozione degli item alle collection e `PlaylistApi.createPlaylist`, `addItemToPlaylist`, `moveItem`, `removeItemFromPlaylist`, `getPlaylistItems`. Verificare signature realmente disponibili in Jellyfin 12 installato (OpenAPI/server) e autorizzazioni; usare il body dove raccomandato, non query obsolete. Non hardcodare token o API key nel client e non introdurre un proxy pubblico privilegiato.

Se le **raccolte davvero personali/private con visibilità per account** non possono essere garantite da Collections native, documentare il limite e scegliere, in ordine: playlist per-user se semanticamente adeguate, oppure progettare **una piccola componente backend autenticata e autorizzata**, approvata prima di implementarla. Il fallback non deve presentare un controllo privacy fittizio.

**Criterio accettazione:** creare raccolta mista con 2 film e 2 serie; mostrarla in homepage; aprirla; aggiungere un titolo dalle card; eliminarne uno senza toccare il file; aggiornare browser; controllare persistenza e permessi anche da secondo utente non admin.

## 8. MOTION DESIGN — BELLO MA NON PESANTE

| Elemento | Animazione | Durata target |
| --- | --- | --- |
| Navbar su scroll | opacità/ombra/blur progressivo senza layout shift | 180–250ms |
| Card hover/focus | translateY -4px, scale ≤1.045, glow soft e action overlay | 180–240ms |
| Apertura modal/drawer | fade + translateY 8–12px; focus trap | 220–300ms |
| Hero cambio slide | crossfade + leggerissimo zoom immagine, niente rotazione | 550–750ms |
| Route change | dissolve/skeleton, nessuna pagina bianca | 150–250ms |
| Progress/loading | shimmer molto discreto e limitato | loop solo finché necessario |
| Aggiunta alla raccolta | check/icon feedback e toast | 180–300ms |

- Abilitare `prefers-reduced-motion` per disattivare traslazioni, autoplay e animazioni non essenziali. 
- Evitare particelle galattiche continue, starfield aggressivo, tremolii, parallax scroll pesante, rumori o trailer che partono autonomamente.
- Eventuale texture cosmic haze statica molto debole nelle aree neutre, mai tra il testo e il backdrop cinematografico.

## 9. ARCHITETTURA IMPLEMENTATIVA

### Stack e layering

1. **Base:** Jellyfin 12 Modern Web UI e API ufficiali (React/MUI + componenti Jellyfin esistenti). Legacy come supporto secondario, mai rompere funzioni chiave.
2. **Funzionalità già coperte:** KefinTweaks (Skin Manager, homepage, watchlist, collections/playlist UX), Jellyfin Enhanced (Seerr/*arr, player/metadata, pages), Intro Skipper. Preferirle al reimplementare UI logica già solida.
3. **Nebula CSS:** design tokens + fogli per navbar, hero, rails, cards, modals, details, player, plugin-compat, responsive; selettori con namespace, CSS variables Modern e override circoscritti.
4. **Nebula JavaScript condizionale:** solo per UI necessarie non ottenibili via CSS/feature plugin (es. card overlay complessa o raccolte create con wizard); mount/unmount idempotenti quando SPA cambia route; listener puliti; nessun polling aggressivo.
5. **Backend opzionale:** SOLO se Jellyfin API non supportano permessi/persistenza delle raccolte personali richieste. Deve essere autenticato e separato dal media server.

### Regola di precedenza

**Una sola skin visiva attiva alla volta.** ElegantFin resta installata per rollback, ma non si deve caricare insieme a Nebula. JS Injector e Skin Manager non devono inserire fogli CSS duplicati. Gli script di Nebula si attivano solo quando la skin Nebula è selezionata, usando il metodo più affidabile scoperto nel codice della versione attuale di KefinTweaks.

**Non basare l'integrazione su un ipotetico schema JSON della skin**: analizzare `skinManager.js`, `skinConfig.js` e configurazione del branch/tag in uso; usare Custom Skin via URL solo dopo verifica reale. Nel repository usare release/tag fissi o asset locali, non `@latest` indiscriminatamente in produzione.

### Struttura repository proposta

```text
biaflix-nebula/
  README.md
  LICENSE
  docs/
    SPEC.md
    plugin-audit.md
    install.md
    rollback.md
    compatibility.md
    QA.md
  src/
    styles/
      tokens.css
      base.css
      navbar.css
      hero.css
      rails.css
      cards.css
      details.css
      collections.css
      search.css
      player.css
      plugin-compat.css
      responsive.css
      reduced-motion.css
    scripts/
      loader.ts
      lifecycle.ts
      collections.ts
      playlist.ts
      cards.ts
      flags.ts
      jellyfin-api.ts
    assets/
      README-logo-source.md
  tests/
    e2e/
    unit/
  dist/
    nebula.css
    nebula.js
```

Ogni file JS ha guardie contro reiniezioni multiple in SPA, cleanup listener e osservatori mirati. Evitare global CSS `*`, `!important` a cascata e selettori MUI hash instabili. Non sovrascrivere file core Jellyfin se c'è un punto di estensione supportato. Non eseguire `curl | bash` o install script remoti sulla produzione per realizzare una skin.

### Asset e deployment

- Modalità preferita: caricare `nebula.css` come **Custom Skin di KefinTweaks**, verificando il formato richiesto dalla versione corrente. Pubblicare assets su repo GitHub con URL accessibili dai client (preferibile rilascio versionato) oppure servirli dallo stesso host Jellyfin, se tecnicamente/sicuramente possibile.
- Se il comportamento JS aggiuntivo è indispensabile, iniettarlo separatamente via JS Injector, compatibilmente con `File Transformation`, con feature flags e possibilità di spegnimento immediato.
- Avere una singola fonte del logo originale Biaflix (header, login, eventuale favicon) con varianti dark e ad alta densità; non sostituire il logo da screenshot ritagliato.
- Non promettere personalizzazione dei client nativi Roku/TV: i CSS si applicano ai client che caricano Jellyfin Web. Documentare gli altri client come non modificabili o parziali.

## 10. AUDIT PLUGIN OBBLIGATORIO (PRIMA DI DISABILITARE)

**Procedura:** esportare config KefinTweaks in JSON (funzione export ufficiale), documentare screenshot e setting dell'attuale Jellyfin Enhanced, elenco script JS Injector, CSS del server e dell'utente, plugin versioni, modalità Jellyfin 12 Modern/Legacy e configurazione Seerr. **Non includere API keys o token nei log/commit**. Snapshot dello stato della UI e test audio/video prima di ogni cambiamento.

### KefinTweaks — scelta raccomandata di Nebula

| Funzione / feature | Raccomandazione iniziale | Motivazione / conflitto da testare |
| --- | --- | --- |
| Skin Manager | **ON** | registrarvi `Biaflix Nebula`; ElegantFin resta fallback; solo un tema attivo |
| Enhanced Home Screen, custom sections, Spotlight, Pinned | **ON** | render dati reali per hero, rails, collezioni senza duplicazioni |
| Watchlist | **ON** | fonte canonica dello stato *da vedere*; confermare sync con JE Seerr |
| Collection Sorting | **ON** | utile per raccolte; stile via Nebula |
| Playlist UX | **ON** | ordinamento/riproduzione playlist; non duplicare UI controls |
| Collections on Details | **ON**, se disponibile | sezione «Incluso in» e navigazione raccolte |
| Episodes on Series Page | **ON** | esperienza serie migliore; adeguare i CSS |
| Series Info+ | **ON**, se non duplica metadata | conservare informazioni utili |
| Item Version Preferences | **ON**, se utenti usano versioni/edizioni | rispettare scelta video e lingua |
| Breadcrumbs | **ON** | navigazione accessibile; non replicare nei nuovi componenti |
| Desktop Hamburger Menu | **VALUTARE / OFF se c'è un drawer Nebula funzionante** | mai due pulsanti o drawer sovrapposti; mantieni fallback per admin/mobile |
| Games | **OFF** (come screenshot) | fuori direzione visiva prodotto |
| Thumbnail Scrubber | **OPZIONALE / OFF di default** | spesso pesante; abilitarlo solo nel player dopo perf test |
| Watch Together | **OPZIONALE / OFF di default** | mantenere solo se realmente usato e testato |
| Subtitle Search | **ON**, se servizio e permessi funzionano | non duplicare con comandi di JE/Jellyfin |
| User Manager | **OFF** (come screenshot) | non serve a tema; non modificare account |
| Remove from Continue Watching | **ON**, salvo conflitti | funzionalità utile nel menu card |
| Header Tabs / Custom Menu Links | **ON o una sola implementazione** | evitare navigazioni duplicate e doppio menu |
| Kefin search + Seerr | **UNA SOLA INTEGRAZIONE VISIBILE** | compatibilità con JE 12.12; test risultati e tasti richiesta |
| Seasonal Animations / Backgrounds | **OFF** | rischiano di sovrastare la direzione Nebula; eccezioni manuali |

I valori sopra sono **target di design**, non dichiarazioni che queste opzioni siano già in tale stato sul server. Nel materiale visibile sono ON: Desktop Hamburger, Breadcrumbs, Playlist UX, Episodes on Series Page, Series Info+, Item Version Preferences, Collection Sorting, Subtitle Search, Thumbnail Scrubber, Watch Together; OFF: Games e User Manager. Controllare ulteriori opzioni nelle altre schede reali.

### Jellyfin Enhanced 12.12 — scelta raccomandata

| Area e opzioni | Target | Note |
| --- | --- | --- |
| Seerr: Search & Requests | **ON** | preservare ricerca titoli non in libreria e richieste manuali; backend/permessi invariati |
| Seerr: Discovery & Extras | **ON condizionale** | sezioni discovery solo se non raddoppiano quelle Kefin, request statuses reali |
| Seerr: auto-request | **OFF salvo esplicita richiesta** | azioni automatiche devono essere volontarie |
| Seerr: watchlist sync | **TEST / ON solo se owner mapping univoco** | un solo stato watchlist, test multi-account e permessi |
| *arr: Sonarr / Radarr | **ON per link e info, admin-gated** | non esporre accessi admin agli utenti normali |
| *arr: Shoko | **OFF se non installato** | no sezioni fantasma |
| Display: media/quality tags, metadata icons | **ON selettivo** | max 1–2 badge utili per card, il resto in dettagli; colori token Nebula |
| Display: MDBList ratings / sync | **OPZIONALE**, solo se configurato | non sostituire valutazioni con dati inattendibili; indicare fonte |
| Display: Spoiler Guard | **ON per episodi/thumbnail a rischio spoiler** | preservare preferenze utente |
| Display: Random Button | **UNO SOLO**, opzionale | evitare doppione con quick actions o Kefin |
| Playback: Custom Pause Screen | **ON se verificato con CSS Nebula** | lo stile glass non blocchi player o pulsanti |
| Playback: Bookmarks | **ON** | feature utile; devono comparire integrazioni non duplicate |
| Playback: tab auto-pause / PiP / auto-skip / subtitles | **PRESERVARE PREFERENZE UTENTE** | non azzerare preferenze esistenti né forzare autoskip |
| Pages: Requests | **ON** se Seerr collegato | usarla come destinazione reale nella navbar |
| Pages: Calendar | **OPZIONALE** | per utenti che seguono nuove uscite, no menu affollato |
| Pages: Recommendations | **ON condizionale** | non ripetere 2 righe raccomandazioni uguali |
| Pages: Activity | **OFF sul menu principale** | solo in drawer / admin se serve |
| Pages: Catch Up | **OFF di default** | funzione nuova 12.12 per gestione visioni: utile solo se richiesta |
| Pages: Bookmarks | **ON accessibile da user menu** | no tab homepage obbligatoria |
| Pages: Hidden Content | **ON solo se richiesto** | nessuna rimozione reale dei media |
| Pages placement | **Native Home Tabs oppure Plugin Pages, non duplicati** | in Jellyfin 12 Modern i link Plugin Pages nel drawer hanno limiti su desktop |
| Elsewhere: providers / user reviews | **OPZIONALE** | costo visivo/rete; evitare branding estraneo e blocchi di pagina |
| Extras: header shortcuts | **SOBRI, max 2–3** | non sovraccaricare la floating navbar |
| Admin: Usage Statistics | **OFF se non serve** | scelta di privacy; nessun tracking decorativo |
| Admin: Maintenance Mode | **OFF** | non attivare per sviluppare CSS |
| Admin: Tag Cache | **Configurare esclusioni se necessario** | miglioramenti 12.12 per grandi librerie, misurare |
| Keyboard | **Preservare/armonizzare** | evitare conflitti con scorciatoie Nebula (es. ricerca) |

**Specificità JE 12.12.0.0 verificata:** Catch Up, override colori tag, provider per stagione, live Plugin Pages 3.0+, gestione richieste migliorata, ottimizzazioni performance. Controllare attivazione per utente: salvare Admin Defaults non impone automaticamente i nuovi valori a chi ha già preferenze personali. Non usare `Overwrite everyone's personal settings` senza consenso esplicito e salvataggio preventivo delle preferenze.

### Altri plugin

- **JS Injector:** mantenere; inventariare script, load order, versioni, doppioni; aggiungere loader Nebula una sola volta solo se necessario.
- **File Transformation:** mantenere se richiesto da JS Injector/Plugin Pages; non modificarne regole accidentalmente.
- **Intro Skipper:** mantenere senza alterare skip markers o video player.
- **Plugin Pages / Custom Tabs:** non installarli solo per una navbar: valutare sistema Native Home Tabs JE, modalità Modern e pagine Kefin; se presenti, audit ed evitare duplicazione delle entry.
- **Qualsiasi altra skin globale, Custom CSS server e user CSS:** esportare e rimuovere dall'applicazione attiva gli import conflittuali solo al momento del cutover; ripristinabili immediatamente.

**Regola di ownership:** *un solo* sistema per styling delle card, *un solo* menu di navigazione desktop, *un solo* schema watchlist, *un solo* presenter di Seerr search, *un solo* spotlight/hero. Le altre integrazioni restano disponibili nei loro pannelli ma non inseriscono una seconda UI sovrapposta.

## 11. TEST E QUALITÀ

### Matrice device/client

- Firefox desktop Linux (obbligatorio), Chromium/Chrome desktop, desktop 1920×1080 e 2560×1440, laptop 1366×768, tablet circa 768×1024, mobile 390×844 e 360×780.
- Jellyfin Web Modern 12.x obbligatorio, Legacy best effort ma senza rotture gravi; browser proxied `biaflix.bia3ia.com` e LAN/Tailscale diretti; Android/iOS embedded se possibile.
- Client nativi che non caricano Jellyfin Web: non attendersi skin, ma funzionamento media/dati intatto.

### Regressioni funzionali imprescindibili

- Riproduci film MKV/MP4, serie/episodio, riprendi da progress, audio/sub e scelta versione, fullscreen, player, Skip Intro.
- Hero e card aprono l'item giusto anche navigando avanti/indietro; nessuna navigazione «morta».
- Jellyfin + Seerr search: nessun titolo duplicato; richieste con messaggi esito; UI da non-admin senza link gestionali Sonarr/Radarr.
- Watchlist aggiungi/rimuovi su card, dettaglio e pagina; stessa consistenza dopo refresh e da altro dispositivo.
- Collezioni miste e playlist: CRUD autorizzato con persistenza server, modifica e rimozione non distruttiva, riordino, avatar/cover e test su secondo utente.
- CSS non altera le pagine admin, plugin settings, editor, campi password o form.
- LXC Jellyfin riavviato solo in finestra autorizzata e **solo** quando TrueNAS NFS risulta montato; non toccare `/mnt/media` o task di cleanup. Nessuna scansione library su mount vuoto.
- Network slow 3G / assets non disponibili: fallback, nessun blank screen. CDN down: fallback a Jellyfin CSS default o asset locale.
- Prestazioni: niente query duplicate per singolo item, cache e request de-dupe; lazy images, nessun layout shift importante; hover fluido; no observer persistente su tutto il DOM se evitabile.
- Accessibilità: tab focus, ESC modali, screen reader labels, contrasto AA, reduced motion, mobile touch.

### Obiettivi misurabili

- Nessun errore JS in console su home/dettagli/playback/collezioni, salvo errori di rete preesistenti annotati.
- Largest Contentful Paint su LAN desktop ragionevole (target ~2.5s su device rappresentativo con cache calda); CLS <0.1 nelle pagine implementate; nessuna allocazione crescente durante 10 cambi pagina SPA; risorse e API monitorate.
- Tutte le azioni CTA testate e operanti; nessun testo mozzato a larghezza 360px; nessun doppio hamburger; nessun contenuto invisibile per skin stacking.

## 12. FASI E DELIVERABLE AGENTE

**Fase 0 — Discovery senza scritture.** Identificare versioni server/web/plugin, ottenere logo sorgente, esportare config non sensibili, fotografare 5 pagine e CSS attuali, verificare NFS e i permessi collection. Consegnare breve rapporto con file, percorsi e plugin ownership. Se una funzione è bloccata dalle API, segnalarlo *prima* di costruire una finta UI.

**Fase 1 — Design system / anteprima reale.** Tokens e componenti Navbar, Hero, poster card, landscape card, collection card, skeleton, modal; mostrare preview desktop/mobile con artwork reale da Jellyfin dove autorizzato. Niente landing page scollegata.

**Fase 2 — Homepage.** Integrare dati e sezioni Jellyfin/Kefin; card premium, featured, in-progress, collections, ricerca; implementare responsive e animazioni.

**Fase 3 — Pagine dettagli/player/search.** Compatibilità JE e Kefin, una sola watchlist, Seerr search e richieste, blur/focus.

**Fase 4 — Raccolte/Playlist.** Creazione, gestione, cover, persistenza, permessi, ricerca multi-select, CRUD, ordinamento; usare API reali.

**Fase 5 — QA, deploy e rollback.** E2E e screenshot matrix; registrare configurazione, pubblicare JS/CSS versionati, aggiungere Nebula a Skin Manager, consentire switch ElegantFin fallback. Non applicare in produzione prima dei test e approvazione esplicita.

**Consegnabili obbligatori**: repository git pulito con codice sorgente e build riproducibile, CSS/JS compilati, test automatici, screenshot desktop/mobile, `install.md`, `rollback.md`, `plugin-audit.md` (valori effettivi con motivazioni e senza segreti), `compatibility.md` (limiti per client), changelog e indicazioni per futura manutenzione con aggiornamenti Jellyfin/JE/Kefin.

### Definition of Done (DoD)

- La UI **sembra Biaflix**, non ElegantFin con palette cambiata; logo originale, dark-only, glass immersivo, layout premium.
- Film e serie hanno poster e thumbnail di qualità, cover responsive, hover/focus e azioni vere.
- Homepage completamente navigabile, dati veri, righe leggibili, niente sezioni duplicate.
- Collezione mista film+serie creata, modificata e persistita con permessi corretti; playlist ordinata funzionante dove supportata.
- Seerr, Sonarr/Radarr, watchlist, player e sottotitoli ancora funzionano.
- Nessun impatto negativo su TrueNAS/NFS/Proxmox e nessun backup automatico introdotto.
- Proprietaria può tornare a ElegantFin/Jellyfin default in pochi clic senza perdere dati o reinstallare Jellyfin.

## 13. FONTI TECNICHE DA RIVERIFICARE ALL'AVVIO DEL LAVORO

1. Jellyfin 12 release e Modern UI: https://jellyfin.org/posts/jellyfin-release-12.0/
2. Jellyfin Custom CSS e limiti web client: https://jellyfin.org/docs/general/clients/css-customization/
3. Jellyfin task per collections/playlists e warning NFS: https://jellyfin.org/docs/general/server/tasks/
4. KefinTweaks README attuale e feature map: https://github.com/ranaldsgift/KefinTweaks
5. KefinTweaks default config: https://github.com/ranaldsgift/KefinTweaks/blob/main/kefinTweaks-default-config.js
6. Jellyfin Enhanced repository: https://github.com/n00bcodr/Jellyfin-Enhanced
7. Jellyfin Enhanced v12.12.0.0: https://github.com/n00bcodr/Jellyfin-Enhanced/releases/tag/12.12.0.0
8. Jellyfin Enhanced Settings Overview: https://n00bcodr.github.io/Jellyfin-Enhanced/getting-started/settings-overview/
9. Jellyfin Enhanced Pages & Tabs: https://n00bcodr.github.io/Jellyfin-Enhanced/getting-started/pages-and-tabs/
10. Jellyfin Enhanced compatibilità: https://n00bcodr.github.io/Jellyfin-Enhanced/getting-started/compatibility/
11. Jellyfin SDK (Collection create): https://typescript-sdk.jellyfin.org/interfaces/generated-client.CollectionApiCreateCollectionRequest.html
12. Jellyfin SDK (Playlist methods): https://typescript-sdk.jellyfin.org/classes/generated-client.PlaylistApi.html
13. Jellyfin Server API policy in release Jellyfin 12: https://jellyfin.org/posts/jellyfin-release-12.0/

---

### ISTRUZIONE FINALE ALL'AGENTE

**Implementa, non improvvisare.** Prima acquisisci fatti mancanti dal server e dalla versione dei plugin; quindi produci codice vero, incrementale, verificabile. Se un controllo richiede API o permessi non disponibili, esplicita il blocco e proponi un'alternativa tecnicamente sostenibile. Non fingere persistenza con localStorage, non rimuovere funzionalità esistenti per semplificare il mockup e non distribuire su produzione senza rollout reversibile.
