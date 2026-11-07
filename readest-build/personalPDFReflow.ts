/**
 * Layout-aware PDF text reflow. PDF.js returns glyph RUNS in visual order,
 * not paragraphs. Reconstruct lines from positions, then make conservative
 * paragraph boundaries without inserting spaces inside adjacent CJK glyphs.
 * No OCR: image-only or incorrectly encoded PDF fonts require a different engine.
 */
export type PersonalPDFTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
};
type Line = { text: string; x: number; y: number; height: number };
const isCJK = (s: string) => /[\u3400-\u9fff\uac00-\ud7af\u3040-\u30ff]$/.test(s);
const beginsCJK = (s: string) => /^[\u3400-\u9fff\uac00-\ud7af\u3040-\u30ff]/.test(s);
const clean = (value: string) =>
  value.normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[\t\r\n]+/g, ' ');
const lineText = (line: string) =>
  line.replace(/[\u00a0 ]+/g, ' ').trim();
const paraJoin = (prior: string, next: string) => {
  const dehyphenate = /[a-z]-$/i.test(prior) && /^[a-z]/.test(next);
  if (dehyphenate) return prior.slice(0, -1) + next;
  if (!prior || !next) return prior + next;
  if (/[\s\u00ad]$/.test(prior) || /^[\s,.:;!?，。)\]』」]/.test(next))
    return prior + next;
  // Wrapped glyphs in a CJK sentence can be adjacent with no word break,
  // but the visual-line join is usually a word break in Korean; preserve a
  // space instead of concatenating unrelated words (unless hyphenated).
  return prior + ' ' + next;
};
export const pdfItemsToParagraphs = (items: PersonalPDFTextItem[]): string[] => {
  const lines: Line[] = [];
  let chunks = '', startX = 0, baselineY = 0, fontHeight = 12;
  let right: number | undefined;
  const flush = () => {
    const text = lineText(chunks);
    if (text) lines.push({text, x:startX,y:baselineY,height:fontHeight});
    chunks=''; right=undefined;
  };
  for(const item of items) {
    const str=clean(item.str ?? '');
    const x=item.transform?.[4] ?? 0;
    const y=item.transform?.[5] ?? 0;
    const h=Math.max(6, Math.abs(item.height || item.transform?.[3] || 12));
    // Some PDFs omit hasEOL altogether. A baseline change still separates
    // lines. Do not let a superscript create a false line break.
    if(chunks && Math.abs(y-baselineY)>Math.max(3,h*.42))flush();
    if(str) {
      if(!chunks){startX=x;baselineY=y;fontHeight=h;}
      const gap=right===undefined?0:x-right;
      const prev=chunks.trimEnd();
      const current=str.trimStart();
      const cjk=isCJK(prev)&&beginsCJK(current);
      const threshold=cjk?h*.62:h*.26;
      if(prev && current && !/\s$/.test(chunks) &&
          !/^[,.:;!?，。)\]』」]/.test(current) && gap>threshold &&
          gap<Math.max(h*3,24)) chunks+=' ';
      chunks+=str;
      right=typeof item.width==='number'?x+item.width:undefined;
    }
    if(item.hasEOL)flush();
  }
  flush();
  // Estimate the PDF's own baseline spacing instead of treating a small
  // text-run height as the whole line height. This avoids making every Korean
  // visual line a separate paragraph in documents with unusually small
  // glyph metric heights or larger CSS-equivalent line spacing.
  const baselineGaps=lines.slice(1).map((line,i)=>({
    delta:lines[i]!.y-line.y,
    maxHeight:Math.max(lines[i]!.height,line.height),
  })).filter(({delta,maxHeight})=>delta>maxHeight*.5&&delta<maxHeight*4.5)
    .map(({delta})=>delta).sort((x,y)=>x-y);
  const medianBaseline=baselineGaps.length
    ? baselineGaps[Math.floor((baselineGaps.length-1)/2)]!
    : 0;
  const out:string[]=[];
  let previous: Line|undefined;
  for(const ln of lines){
    const delta=previous ? Math.abs(previous.y-ln.y) : 0;
    const indent=previous ? ln.x-previous.x : 0;
    const typical=previous ? Math.max(previous.height,ln.height) : ln.height;
    // Columns / large line gaps / positive first-line indentation indicate
    // a new paragraph. A line's own hasEOL never alone implies paragraph.
    const boundary=!previous ||
      (previous !== undefined && ln.y > previous.y+typical*1.4) ||
      delta>Math.max(typical*1.35,medianBaseline*1.48,14) ||
      indent>Math.max(typical*1.10,12);
    if(boundary)out.push(ln.text);
    else out[out.length-1]=paraJoin(out[out.length-1] ?? '',ln.text);
    previous=ln;
  }
  return out;
};

export const normalizePDFPage = (value:number | undefined | null, count:number):number =>
  Math.max(1, Math.min(Math.max(1,count), Number.isFinite(value) ? Math.round(value!) : 1));

/** Every source PDF page may become several viewport-sized reflow pages. */
export function stepPDFReflow(
  direction: -1|1,
  sourcePage:number,
  sourceTotal:number,
  slice:number,
  sliceCount:number,
): {page:number; slice:number; atPreviousPageEnd:boolean} {
  const maxSlice=Math.max(0,sliceCount-1);
  if(direction===1 && slice<maxSlice) return {page:sourcePage,slice:slice+1,atPreviousPageEnd:false};
  if(direction===-1 && slice>0) return {page:sourcePage,slice:slice-1,atPreviousPageEnd:false};
  const page=normalizePDFPage(sourcePage+direction,sourceTotal);
  if(page===sourcePage)return {page,slice:Math.min(Math.max(0,slice),maxSlice),atPreviousPageEnd:false};
  return {page,slice:0,atPreviousPageEnd:direction===-1};
}
