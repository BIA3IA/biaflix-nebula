# Rollback di Biaflix Nebula

Nessun rollback richiede reinstallazioni, riavvii di Jellyfin o di LXC 104. Raccolte, playlist e watchlist create con Nebula sono **dati Jellyfin standard**: restano anche senza Nebula.

## Livello 1: un solo browser (10 secondi)

- Icona **Aspetto** nella barra → skin **ElegantFin Biaflix**; oppure
- console del browser: `BiaflixNebula.disable()` (spegne il JS Nebula su quel browser; `BiaflixNebula.enable()` lo riattiva).

## Livello 2: tutti gli utenti (1 minuto)

1. JavaScript Injector → script **«Biaflix Nebula»** → disattivare (o eliminare). Il JS non viene più caricato.
2. KefinTweaks → Skin Manager → **Default skin = ElegantFin Biaflix** (se era stata cambiata).
3. Facoltativo: rimuovere la voce «Biaflix Nebula» dagli _Skins JSON_. I browser che l'avevano selezionata tornano automaticamente alla skin predefinita: lo Skin Manager ripiega sul default se la skin salvata non esiste più.

## Livello 3: ripristino completo dello stato pre-Nebula

1. Livello 2.
2. Branding → Custom CSS: incollare il testo originale salvato in [plugin-audit.md](plugin-audit.md#stile-attivo-oggi).
3. KefinTweaks → Skin Manager → _Skins JSON_: ripristinare `[]` oppure importare l'export JSON del punto 1 di [install.md](install.md).
4. Svuotare la cache del browser (Ctrl+Shift+R) sui client web.

## Se il CDN non è raggiungibile

- `nebula.css` non si carica: lo Skin Manager resta con la skin selezionata ma senza foglio, quindi Jellyfin appare con il tema di default. Leggibile e funzionante.
- `nebula.js` non si carica: lo snippet scrive un avviso in console e Jellyfin continua con la UI standard. Nessuna schermata bianca.

## Raccolte e NFS

- Rimuovere un titolo da una raccolta **non** cancella file: Nebula chiama solo `DELETE /Collections/{id}/Items`.
- Eliminare una raccolta elimina solo l'entità BoxSet. Il client rifiuta per costruzione l'eliminazione di qualsiasi altro tipo di item.
- Con `/mnt/media` non montato, Jellyfin può vedere i titoli come mancanti: **non** avviare scansioni né il task «Clean up collections and playlists». Ripristina prima il mount (fuori dal perimetro di Nebula).
