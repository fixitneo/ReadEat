#!/usr/bin/env bash
set -euo pipefail
# Bundled recorded samples, not synthesized oscillator tones.
# Mixkit Sound Effects Free License permits incorporating SFX into an APK.
dest="upstream/apps/readest-app/public/personal-sounds"
mkdir -p "$dest"
for entry in paper:1104 book:1105 soft:2380; do
  name="$(echo "$entry" | cut -d: -f1)"
  id="$(echo "$entry" | cut -d: -f2)"
  file="$dest/$name.mp3"
  echo "Bundling recorded page sound: $name (Mixkit $id)"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 \
    --connect-timeout 20 --max-time 120 \
    "https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3" --output "$file"
  python3 - "$file" <<'PY'
import sys,os
f=sys.argv[1]
data=open(f,'rb').read(24)
n=os.stat(f).st_size
if n < 1500 or n > 2_000_000:
    raise SystemExit(f'Invalid recorded sound size: {f} ({n} bytes)')
if not (data.startswith(b'ID3') or (len(data)>1 and data[0]==255 and data[1]&224==224)):
    raise SystemExit('Sound asset is not MPEG/MP3: '+f)
print('Verified recorded MP3:',f,n,'bytes')
PY
done
echo 'All three offline paper recordings bundled.'
