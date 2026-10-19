# Logo Biaflix: fonte unica

| File                                 | Uso                                           | Origine                                                                                                                                           |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `biaflix-logo.png` (1254×1254, RGBA) | sorgente ad alta risoluzione, login/splash 2x | copia byte-per-byte di `~/Downloads/Glossy Neon Gradient B Logo.png` (SHA-256 `bd93a56acf9078e923e9cfac35c83f4ecbc672d251aa3b4d6d2708311f13ff8f`) |
| `biaflix-logo-256.png`               | navbar 2x, login 1x                           | ridimensionato con ffmpeg (lanczos) dalla sorgente                                                                                                |
| `biaflix-logo-128.png`               | navbar 1x                                     | idem                                                                                                                                              |

> ⚠️ **Da confermare dalla proprietaria.** La specifica chiede il logo originale «da richiedere/rintracciare in modo autorizzato». Il file è stato trovato nella cartella Download dell'utente; colori e forma (B viola→blu→ciano) coincidono con l'identità descritta, ma la conferma che sia il logo ufficiale va data prima del rilascio. `~/Downloads/Logo.svg` **non** è il logo Biaflix (è il logo PoliNetwork) e non è stato usato.

Per sostituirlo basta rimpiazzare `biaflix-logo.png` e rigenerare le varianti:

```bash
for s in 128 256; do ffmpeg -y -i src/assets/biaflix-logo.png -vf "scale=${s}:${s}:flags=lanczos" src/assets/biaflix-logo-$s.png; done
pnpm build
```

Il logo è un asset proprietario Biaflix ed è escluso dalla licenza MIT del codice.
