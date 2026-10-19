# Changelog

## 0.2.0 (branch `feat/details-redesign`, non rilasciata)

**Pagina dettagli riprogettata** (film, serie, stagioni, episodi, raccolte):

- Hero cinematografico: backdrop a tutta larghezza (fallback: locandina sfocata come luce ambientale), locandina 2:3 grande (16:9 per gli episodi), logo o titolo, metadati essenziali, trama espandibile, regia.
- Azioni: Riproduci/Riprendi in evidenza (prossimo episodio per le serie), Trailer se presente, Watchlist e «Altre azioni». Il menu glass è costruito dai pulsanti nativi visibili (Jellyfin, KefinTweaks, JE), quindi nessuna azione viene duplicata o persa.
- Area unica «Stagioni ed episodi» (sostituisce «Stagioni», «Prossimo», la lista episodi e la sezione episodi di KefinTweaks): schede stagione, griglia 16:9 con progresso, trama e Play nativo.
- «Informazioni» (regia, sceneggiatura, studio, classificazione, stato) e «Dettagli tecnici, tracce e tag» a scomparsa: Media Info, tracce audio/sottotitoli, versioni e tag restano nativi.
- «Cast e troupe»: ritratti circolari 1:1, nome e ruolo, iniziali al posto dei placeholder, «Mostra tutto».
- «Potrebbe piacerti»: un'unica sezione dalla libreria, deduplicata, senza card prive di immagine, «Mostra altri». Le sezioni Seerr di JE sono raggruppate in «Scopri e richiedi».

**Correzioni**

- Scroll orizzontale del documento (fino a +1483px): nel layout desktop lo scroller animato di jellyfin-web 12.2 non ritagliava il contenuto. Ora il ritaglio si applica come nel layout TV.
- Navbar a stadi: ≥1280 completa; 1100–1279 solo logo, SyncPlay e Trasmetti nascosti; 900–1099 link a icona; <900 menu, logo, ricerca e profilo. Nessuna sovrapposizione da 320 a 1920px.
- Menu: niente chiusura indesiderata dovuta allo scroll provocato dal focus; Esc funziona anche prima che il focus entri nel menu.

**Dettagli di finitura**

- Tooltip glass al posto di quelli di sistema (attributo `title` di Jellyfin e plugin), anche da tastiera; nome accessibile preservato.
- Hover delle card senza bordo viola né alone: solo sollevamento e ombra neutra (card native, KefinTweaks, Nebula, episodi, cast).
- KefinTweaks: i controlli accanto ai titoli di sezione (aggiorna, vedi tutto, configura) compaiono al passaggio o con il focus; le categorie Home/Scopri diventano una pillola glass sotto la navbar.
- Jellyfin Enhanced: nelle righe Studi/Network c'erano due frecce «avanti», e quella sulla card non funzionava (scrollBy su uno scroller a transform). Ora resta solo quella funzionante.
- Effetti stagionali di KefinTweaks (Halloween: frangia «sangue» e alone rosso della navbar, sfondi, neve) disattivati con Nebula attiva, come chiede la specifica. Le sezioni di contenuto stagionali restano.
- Jellyfin Enhanced 12.12 con «Use Icons» spento mostrava `{{icon:warning}}` nei testi (es. «Seleziona almeno una stagione»). Correttivo isolato in `compat/je-icon-tokens.ts`, ripristinato allo spegnimento.
- Screenshot non più versionati: i test li scrivono in `test-results/screenshots/`.

**Controlli glass**: popup glass per tutte le select (tastiera, typeahead, foglio dal basso su mobile, compatibile con React); checkbox, toggle e radio di Jellyfin, MUI e plugin restilizzati senza toccarne la logica.

**Ambiente di test**: `pnpm dev:plugins` installa nel Jellyfin locale le stesse versioni di KefinTweaks, JE, JS Injector, File Transformation e Plugin Pages della produzione; la configurazione KefinTweaks pubblica viene replicata. Nuova matrice responsive a 7 larghezze in Firefox e Chromium.

## 0.1.2 (confluita nella 0.2.0)

- Mobile: barra di navigazione glass in basso (Home, Film, Serie TV, Raccolte, Cerca) con le librerie reali.
- Mobile: header essenziale (menu, logo, tavolozza skin, avatar); corretto il logo che copriva l'icona SyncPlay.
- Drawer (menu laterale) glass fluttuante su tutte le larghezze, con logo Biaflix e voci senza tagli.
- Hero mobile: locandina nitida su sfondo ambientale, CTA a tutta larghezza, swipe tra le slide.

## 0.1.1

- Pubblicazione: `dist/` ora è incluso nel repository (era escluso da una regola `dist` nel gitignore globale), così jsDelivr serve `nebula.css`, `nebula.js` e il logo.
- Snippet JS Injector già puntato a `BIA3IA/biaflix-nebula`.

## 0.1.0

Prima versione funzionante, verificata su Jellyfin 12.2 locale.

- Design system Nebula: token, navbar flottante glass, card, hero, dettagli, player, ricerca, compatibilità KefinTweaks 0.5.1 / Jellyfin Enhanced 12.12.
- Homepage: hero cinematografico da dati reali, rail «Le mie raccolte» e «La mia watchlist».
- Raccolte miste film + serie: crea, aggiungi a…, gestisci, hub, filtro tipo, collage automatico; mutazioni serializzate e verificate sul server.
- Playlist: creazione privata/pubblica e aggiunta titoli.
- Watchlist su `UserData.Likes`, condivisa con JE/Seerr.
- Attivazione legata allo Skin Manager KefinTweaks; kill switch per browser; i18n it/en.
- Ambiente di sviluppo Docker con media sintetici, 37 test unitari, 40 E2E su 3 profili.
