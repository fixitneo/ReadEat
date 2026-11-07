#!/usr/bin/env python3
"""Install the user-selected transparent antique-book icon into Readest's Android launcher.
Consumes committed webp-base64 source; runs after upstream Android native resources
are restored. No external asset URLs or original Readest app icon are used.
"""
from __future__ import annotations
import base64
from io import BytesIO
from pathlib import Path
import sys
from PIL import Image, ImageOps

REPO=Path(__file__).resolve().parent
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('upstream')
APP=ROOT/'apps/readest-app'
MAIN=APP/'src-tauri/gen/android/app/src/main/res'
SRC=APP/'src-tauri/icons'
encoded=(REPO/'antique-bookstack-icon.webp.b64').read_text(encoding='ascii').strip()
books=Image.open(BytesIO(base64.b64decode(encoded,validate=True))).convert('RGBA')
assert books.size[0]>=96 and books.size[1]>=96, books.size
assert books.getchannel('A').getextrema()==(0,255), 'The source icon must have transparent exterior and opaque books'
resample=Image.Resampling.LANCZOS

def render(size:int, fill:float)->Image.Image:
    canvas=Image.new('RGBA',(size,size),(0,0,0,0))
    bbox=books.getchannel('A').getbbox()
    assert bbox
    trimmed=books.crop(bbox)
    edge=max(1,int(size*fill))
    thumb=ImageOps.contain(trimmed,(edge,edge),resample)
    canvas.alpha_composite(thumb,((size-thumb.width)//2,(size-thumb.height)//2))
    return canvas

def save(img:Image.Image,path:Path):
    path.parent.mkdir(parents=True,exist_ok=True)
    img.save(path,'PNG',optimize=True)

# Tauri sources: these ensure subsequent Tauri asset regeneration also uses this artwork.
for name,dim in [('32x32.png',32),('128x128.png',128),('128x128@2x.png',256),('icon.png',512)]:
    save(render(dim,.94), SRC/name)

# Full-color launcher asset, circular launchers, adaptive foreground and
# monochrome themed icon. Preserve alpha in ALL color resources, including
# fallback square mipmaps and the foreground. No white bitmap background.
DENSITIES={'mdpi':(48,108),'hdpi':(72,162),'xhdpi':(96,216),
           'xxhdpi':(144,324),'xxxhdpi':(192,432)}
for density,(legacy,adaptive) in DENSITIES.items():
    root=MAIN/f'mipmap-{density}'
    srcroot=SRC/f'android/mipmap-{density}'
    for dest in (root,srcroot):
        save(render(legacy,.94),dest/'ic_launcher.png')
        save(render(legacy,.94),dest/'ic_launcher_round.png')
        save(render(adaptive,.68),dest/'ic_launcher_foreground.png')
        mono=render(adaptive,.68)
        alpha=mono.getchannel('A')
        grayscale=Image.new('RGBA',(adaptive,adaptive),(255,255,255,0))
        grayscale.putalpha(alpha)
        save(grayscale,dest/'ic_launcher_monochrome.png')

# Android adaptive-icon XML has a mandatory two-layer model. Keep the
# background drawable fully TRANSPARENT rather than painting white.
xml='''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@android:color/transparent"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
'''
for folder in (MAIN,SRC/'android'):
    dest=folder/'mipmap-anydpi-v26/ic_launcher.xml'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(xml,encoding='utf-8')

# Prevent Android launchers from falling back to the old Readest icon.
assert (MAIN/'mipmap-xxxhdpi/ic_launcher.png').is_file()
assert b'transparent' in (MAIN/'mipmap-anydpi-v26/ic_launcher.xml').read_bytes()
for check in ('mipmap-mdpi/ic_launcher.png','mipmap-hdpi/ic_launcher_foreground.png'):
    img=Image.open(MAIN/check)
    assert img.mode=='RGBA' and img.getpixel((0,0))[3]==0
print('Installed transparent antique-bookstack launcher resources in five densities and Tauri icons.')
