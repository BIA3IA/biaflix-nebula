#!/usr/bin/env bash
# Arricchisce la libreria sintetica per testare la pagina dettagli in condizioni realistiche:
# cast numeroso (alcuni senza foto), regia, studi, molti tag, seconda stagione, logo, film senza backdrop.
# Idempotente: riscrive solo NFO e file aggiuntivi. Nessun contenuto reale.
set -euo pipefail
ROOT="${1:-$(dirname "$0")/.data/media}"
ff() { ffmpeg -loglevel error -nostdin -y "$@"; }

cast_xml() {
  local roles=("Capitana Vega" "Dottor Orione" "Lyra" "Il Custode" "Comandante Rho" "Mira" "Tecnico Kato" "Voce dell'IA" "Pilota Dax" "Ambasciatrice Sol" "Bambina Nova" "Narratore")
  local names=("Aurora Bianchi" "Marco Lentini" "Sofia Ricci" "Davide Conti" "Elena Marino" "Luca Ferri" "Giulia Moretti" "Paolo Greco" "Chiara Gallo" "Andrea Costa" "Marta Esposito" "Roberto Fontana")
  local n="${1:-12}"
  for ((i = 0; i < n; i++)); do
    printf '<actor><name>%s</name><role>%s</role><type>Actor</type><order>%d</order></actor>' "${names[$i]}" "${roles[$i]}" "$i"
  done
  printf '<director>Bianca Ianosel</director><writer>Nadia Serra</writer><credits>Nadia Serra</credits>'
}

tags_xml() {
  for t in villain robot scientist "time travel" "space station" mystery friendship cyberpunk "found family" "artificial intelligence" "based on novel" rivalry; do printf '<tag>%s</tag>' "$t"; done
}

movie_nfo() {
  local dir="$1" title="$2" year="$3" genre="$4" plot="$5"
  cat >"$dir/$title ($year).nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie><title>$title</title><year>$year</year><genre>$genre</genre><genre>Adventure</genre><plot>$plot Una storia che attraversa luci e ombre della città, tra segreti di famiglia, alleanze inattese e scelte che cambiano tutto.</plot><runtime>104</runtime><mpaa>T</mpaa><rating>7.4</rating><studio>Nebula Pictures</studio><tagline>Ogni luce ha la sua ombra.</tagline>$(cast_xml 12)$(tags_xml)</movie>
EOF
}

M="$ROOT/movies"
movie_nfo "$M/Orbita Viola (2024)" "Orbita Viola" 2024 "Sci-Fi" "Una pilota attraversa una nebulosa viola alla ricerca della sorella scomparsa."
movie_nfo "$M/Ultima Proiezione (2021)" "Ultima Proiezione" 2021 "Drama" "Un vecchio cinema di quartiere vive la sua ultima, lunghissima notte."
movie_nfo "$M/Il Faro Ciano (2019)" "Il Faro Ciano" 2019 "Mystery" "Su un'isola remota, un faro si accende da solo ogni notte di luna nuova."

# Logo trasparente (clearlogo) per un film
[[ -f "$M/Orbita Viola (2024)/logo.png" ]] || ff -f lavfi -i "color=c=black@0.0:s=800x260,format=rgba" \
  -vf "drawtext=text='ORBITA VIOLA':fontcolor=white:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=0x854bff" \
  -frames:v 1 "$M/Orbita Viola (2024)/logo.png"

# Film senza backdrop: fallback del hero
rm -f "$M/Il Faro Ciano (2019)/backdrop.jpg"

# Serie con due stagioni, cast e crew
S="$ROOT/shows/Nebula Station (2022)"
cat >"$S/tvshow.nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow><title>Nebula Station</title><year>2022</year><genre>Sci-Fi</genre><genre>Animation</genre><genre>Comedy</genre><plot>Gli abitanti di una stazione orbitante affrontano misteri, esperimenti fuori controllo e alleanze improbabili, una puntata dopo l'altra.</plot><mpaa>T</mpaa><rating>8.1</rating><studio>Nebula Animation</studio><status>Continuing</status>$(cast_xml 12)$(tags_xml)</tvshow>
EOF
mkdir -p "$S/Season 02"
for e in 1 2; do
  ep=$(printf "S02E%02d" "$e")
  f="$S/Season 02/Nebula Station $ep.mkv"
  [[ -f "$f" ]] || ff -f lavfi -i "testsrc2=s=1280x720:r=24:d=6" -f lavfi -i "sine=frequency=440:d=6" -vf "hue=h=$((200 + e * 30))" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest "$f"
  [[ -f "$S/Season 02/Nebula Station $ep-thumb.jpg" ]] || ff -f lavfi -i "gradients=s=1280x720:c0=0x0b1230:c1=0x39d4e8:x0=0:y0=0:x1=1280:y1=720:d=1" -vf "drawtext=text='$ep':fontcolor=white:fontsize=90:x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 "$S/Season 02/Nebula Station $ep-thumb.jpg"
  cat >"$S/Season 02/Nebula Station $ep.nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails><title>Ritorno al modulo $e</title><season>2</season><episode>$e</episode><runtime>22</runtime><plot>Nella seconda stagione l'equipaggio scopre un segnale proveniente dal modulo $e, abbandonato da decenni.</plot></episodedetails>
EOF
done
for e in 1 2 3; do
  ep=$(printf "S01E%02d" "$e")
  cat >"$S/Season 01/Nebula Station $ep.nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails><title>Episodio $e: Orbita bassa</title><season>1</season><episode>$e</episode><runtime>22</runtime><plot>L'equipaggio affronta un guasto inatteso al sistema di navigazione e deve collaborare con un vecchio rivale per riportare la stazione in orbita stabile.</plot></episodedetails>
EOF
done
echo "Libreria arricchita in $ROOT"
