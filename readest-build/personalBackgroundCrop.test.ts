import {describe,it,expect} from 'vitest';
import {backgroundCropKey,normalizeBackgroundCrop} from '@/utils/personalBackgroundCrop';

describe('personal background crop',()=>{
  it('separates folded and unfolded profiles',()=>{
    expect(backgroundCropKey('wallpaper','folded')).not.toBe(backgroundCropKey('wallpaper','unfolded'));
  });
  it('clamps zoom and placement to a frame-safe region',()=>{
    expect(normalizeBackgroundCrop({zoom:9,x:400,y:-400})).toEqual({zoom:3,x:100,y:-100});
    expect(normalizeBackgroundCrop({zoom:1,x:20,y:-20})).toEqual({zoom:1,x:0,y:0});
  });
  it('rejects invalid saved crop data',()=>{
    expect(normalizeBackgroundCrop({zoom:NaN,x:Infinity,y:-Infinity})).toEqual({zoom:1,x:0,y:0});
  });
});
