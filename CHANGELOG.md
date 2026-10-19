# Changelog

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
