import { describe, expect, it } from 'vitest';
import { PageCurlRenderer } from '@/utils/pageCurl';
import { normalizePageMotion } from '@/utils/personalInteraction';
describe('personal WebGL curl presets on a real GPU context',()=>{
  it('keeps text upright, renders distinct curved sheets and clears the completed sheet',async()=>{
    const source=document.createElement('canvas');source.width=400;source.height=700;
    const context=source.getContext('2d')!;context.fillStyle='#f4eedb';context.fillRect(0,0,400,700);
    context.fillStyle='#172832';context.font='24px sans-serif';
    for(let y=40;y<660;y+=40)context.fillText('Page curl / 가 나 다 '+y,20,y);
    const bitmap=await createImageBitmap(source);
    const fingerprints:string[]=[];
    for(const preset of ['apple','google'] as const){
      const host=document.createElement('div');document.body.append(host);
      const renderer=new PageCurlRenderer({motion:()=>normalizePageMotion({personalPageCurl:preset})});
      try{
        renderer.attach(host,400,700,1);renderer.setTexture(bitmap);renderer.render(0,{x:1,y:.9});
        expect(renderer.isUsable()).toBe(true);
        expect(renderer.readPixel(10,10)[3]).toBe(255);
        renderer.render(.43,{x:1,y:.9});
        const pixels=[];
        for(let y=20;y<700;y+=40)for(let x=20;x<400;x+=40)pixels.push(renderer.readPixel(x,y));
        fingerprints.push(JSON.stringify(pixels));
        expect(pixels.some(p=>p[3]===0)).toBe(true);
        expect(pixels.some(p=>p[3]===255)).toBe(true);
        renderer.render(1,{x:1,y:.9});
        expect(renderer.readPixel(390,10)[3]).toBe(0);
      }finally{renderer.dispose();host.remove();}
    }
    bitmap.close();expect(fingerprints[0]).not.toEqual(fingerprints[1]);
  });
});
