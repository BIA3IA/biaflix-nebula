#!/usr/bin/env bash
# Genera una libreria sintetica (film + serie) per l'ambiente di sviluppo locale.
# Nessun contenuto reale: video di test ffmpeg, poster/backdrop generati, metadati NFO.
set -euo pipefail

ROOT="${1:-$(dirname "$0")/.data/media}"
mkdir -p "$ROOT/movies" "$ROOT/shows"

ff() { ffmpeg -loglevel error -nostdin -y "$@"; }

# $1 out, $2 size, $3 colore A, $4 colore B, $5 titolo
art() {
  local out="$1" size="$2" c0="$3" c1="$4" title="$5"
  ff -f lavfi -i "gradients=s=${size}:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=${size%x*}:y1=${size#*x}:d=1" \
     -vf "drawtext=text='${title}':fontcolor=white@0.92:fontsize=h/12:x=(w-text_w)/2:y=h*0.72:box=1:boxcolor=black@0.25:boxborderw=18" \
     -frames:v 1 -q:v 3 "$out"
}

clip() {
  local out="$1" seconds="$2" hue="$3"
  ff -f lavfi -i "testsrc2=s=1280x720:r=24:d=${seconds}" -f lavfi -i "sine=frequency=330:d=${seconds}" \
     -vf "hue=h=${hue}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest "$out"
}

movie() {
  local name="$1" year="$2" c0="$3" c1="$4" hue="$5" genre="$6" plot="$7"
  local dir="$ROOT/movies/$name ($year)"
  [[ -f "$dir/$name ($year).mkv" ]] && return
  mkdir -p "$dir"
  clip "$dir/$name ($year).mkv" 12 "$hue"
  art "$dir/poster.jpg" 600x900 "$c0" "$c1" "$name"
  art "$dir/backdrop.jpg" 1920x1080 "$c1" "$c0" "$name"
  cat >"$dir/$name ($year).nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie><title>$name</title><year>$year</year><genre>$genre</genre><plot>$plot</plot><runtime>1</runtime><officialrating>T</officialrating></movie>
EOF
}

show() {
  local name="$1" year="$2" c0="$3" c1="$4" hue="$5" genre="$6" plot="$7" episodes="$8"
  local dir="$ROOT/shows/$name ($year)"
  [[ -d "$dir/Season 01" ]] && return
  mkdir -p "$dir/Season 01"
  art "$dir/poster.jpg" 600x900 "$c0" "$c1" "$name"
  art "$dir/backdrop.jpg" 1920x1080 "$c1" "$c0" "$name"
  cat >"$dir/tvshow.nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow><title>$name</title><year>$year</year><genre>$genre</genre><plot>$plot</plot></tvshow>
EOF
  for ((e = 1; e <= episodes; e++)); do
    local ep
    ep=$(printf "S01E%02d" "$e")
    clip "$dir/Season 01/$name $ep.mkv" 8 "$((hue + e * 20))"
    art "$dir/Season 01/$name $ep-thumb.jpg" 1280x720 "$c1" "$c0" "$ep"
    cat >"$dir/Season 01/$name $ep.nfo" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails><title>Episodio $e</title><season>1</season><episode>$e</episode><plot>Trama dell'episodio $e di $name.</plot></episodedetails>
EOF
  done
}

movie "Orbita Viola" 2024 0x2a0f5c 0x476dff 0 "Sci-Fi" "Una pilota attraversa una nebulosa viola alla ricerca della sorella scomparsa."
movie "Ultima Proiezione" 2021 0x0b1230 0x854bff 60 "Drama" "Un vecchio cinema di quartiere vive la sua ultima, lunghissima notte."
movie "Il Faro Ciano" 2019 0x062a33 0x39d4e8 120 "Mystery" "Su un'isola remota, un faro si accende da solo ogni notte di luna nuova."
movie "Neon Halloween" 2023 0x1a0821 0xff657f 180 "Horror" "Una festa in maschera degenera quando le luci al neon iniziano a sussurrare."
movie "Comfort Club" 2018 0x14213d 0x53d8a3 240 "Comedy" "Tre amici aprono un locale dove si guardano solo film consolatori."
show "Nebula Station" 2022 0x16083a 0x476dff 30 "Sci-Fi" "Gli abitanti di una stazione orbitante affrontano misteri e alleanze." 3
show "Le Cronache di Bia" 2020 0x21103f 0xb16dff 90 "Fantasy" "Un regno sospeso tra sogno e realtà, raccontato episodio dopo episodio." 2
show "Serata Horror" 2024 0x200510 0xff657f 150 "Horror" "Antologia di storie brevi per le notti d'ottobre." 2

echo "Media sintetici pronti in $ROOT"
