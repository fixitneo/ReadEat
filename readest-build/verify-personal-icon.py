#!/usr/bin/env python3
"""Fail CI when the distributed Android launcher still uses upstream Readest."""
from pathlib import Path
from io import BytesIO
import base64, hashlib, sys
from PIL import Image

root=Path(sys.argv[1] if len(sys.argv)>1 else 'upstream')
recipe=Path(__file__).resolve().parent
encoded=(recipe/'antique-bookstack-icon.webp.b64').read_text(encoding='ascii').strip()
art=base64.b64decode(encoded,validate=True)
EXPECTED_SHA256='e26c37f621ee2cacb7f0e0654c2161503db3cb5df30597db90cfaf54def250ec'
assert hashlib.sha256(art).hexdigest()==EXPECTED_SHA256,'Antique-book source differs from selected generated icon'
input_art=Image.open(BytesIO(art)).convert('RGBA')
assert input_art.size == (128,128),'Unexpected icon source resolution'
assert input_art.getchannel('A').getextrema() == (0,255),'Expected truly transparent pixels in art'

app=root/'apps/readest-app/src-tauri'
res=app/'gen/android/app/src/main/res'
assert (res/'mipmap-anydpi-v26/ic_launcher.xml').is_file()
xml=(res/'mipmap-anydpi-v26/ic_launcher.xml').read_text()
assert '@android:color/transparent' in xml,'Adaptive icon background is not transparent'
assert '@mipmap/ic_launcher_foreground' in xml
assert '@mipmap/ic_launcher_monochrome' in xml
for density,base,front in [
    ('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),
    ('xxhdpi',144,324),('xxxhdpi',192,432)
]:
    for filename,size in [
        ('ic_launcher.png',base),('ic_launcher_round.png',base),
        ('ic_launcher_foreground.png',front),('ic_launcher_monochrome.png',front)
    ]:
        p=res/f'mipmap-{density}'/filename
        assert p.is_file(),str(p)
        im=Image.open(p).convert('RGBA')
        assert im.size == (size,size),(p,im.size)
        alpha=im.getchannel('A')
        assert alpha.getpixel((0,0)) == 0,f'White or opaque icon background: {p}'
        assert alpha.getbbox(),f'Empty icon: {p}'
for size,filename in [(32,'32x32.png'),(128,'128x128.png'),(256,'128x128@2x.png')]:
    p=app/'icons'/filename
    im=Image.open(p).convert('RGBA')
    assert im.size==(size,size)
    assert im.getpixel((0,0))[3]==0
print('PASS: original generated bookstack artwork, launcher densities, transparent adaptive/background/monochrome and Tauri sources.')
