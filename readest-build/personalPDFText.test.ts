import { describe, it, expect } from 'vitest';
import { pdfItemsToParagraphs, normalizePDFPage, stepPDFReflow } from '@/utils/personalPDFReflow';

describe('Personal PDF reflow', () => {
  it('joins consecutive visual lines and preserves real paragraph gaps', () => {
    const items = [
      {str:'『더 클래식』 시리즈의 두 번째 책을 펴냅니다.', hasEOL:true, transform:[12,0,0,12,38,180], height:12, width:270},
      {str:'첫 번째 책에는 바흐에서 베토벤까지', hasEOL:true, transform:[12,0,0,12,24,164], height:12, width:240},
      {str:'34곡의 필수적인 걸작들을 소개했습니다.', hasEOL:true, transform:[12,0,0,12,24,148], height:12, width:240},
      {str:'음악 분야에서는 수많은 천재들이 활약했습니다.', hasEOL:true, transform:[12,0,0,12,38,106], height:12, width:270},
      {str:'그중에 어떤 이들은 자신의 재능을', hasEOL:true, transform:[12,0,0,12,24,90], height:12, width:240},
    ];
    expect(pdfItemsToParagraphs(items)).toEqual([
      '『더 클래식』 시리즈의 두 번째 책을 펴냅니다. 첫 번째 책에는 바흐에서 베토벤까지 34곡의 필수적인 걸작들을 소개했습니다.',
      '음악 분야에서는 수많은 천재들이 활약했습니다. 그중에 어떤 이들은 자신의 재능을',
    ]);
  });
  it('does not inject spaces inside split Korean glyph/font fragments', () => {
    const items = [
      {str:'한',transform:[12,0,0,12,10,100],width:12},
      {str:'글',hasEOL:true,transform:[12,0,0,12,22,100],width:12},
    ];
    expect(pdfItemsToParagraphs(items)).toEqual(['한글']);
  });
  it('joins a line-break hyphenation without an extra hyphen', () => {
    expect(pdfItemsToParagraphs([
      {str:'A connec-',hasEOL:true,transform:[12,0,0,12,10,100],height:12},
      {str:'tion across lines',hasEOL:true,transform:[12,0,0,12,10,85],height:12},
    ])).toEqual(['A connection across lines']);
  });
  it('returns an empty list for image-only PDF pages', () => {
    expect(pdfItemsToParagraphs([])).toEqual([]);
  });
});


describe('PDF text layout and native progress', () => {
  it('recognizes new lines from their baselines even without PDF hasEOL', () => {
    expect(pdfItemsToParagraphs([
      {str:'글쓰기란',transform:[12,0,0,12,20,100],height:12,width:60},
      {str:'보여주기다.',transform:[12,0,0,12,20,85],height:12,width:90},
    ])).toEqual(['글쓰기란 보여주기다.']);
  });
  it('joins compact Korean glyph fragments without artificial spaces', () => {
    const items = ['글','을',' ', '쓰','는',' ', '법'].map((str,i)=>({
      str,transform:[12,0,0,12,10+i*12,100],height:12,width:12,
    }));
    expect(pdfItemsToParagraphs(items)).toEqual(['글을 쓰는 법']);
  });
  it('does not interpret mere PDF visual line endings as paragraph breaks', () => {
    expect(pdfItemsToParagraphs([
      {str:'먼저 글을 쓴다',hasEOL:true,transform:[11,0,0,11,18,100],height:11,width:100},
      {str:'그다음 고친다',hasEOL:true,transform:[11,0,0,11,18,86],height:11,width:100},
    ])).toEqual(['먼저 글을 쓴다 그다음 고친다']);
  });
  it('starts from the saved 1-based page and bounds out-of-range progress', () => {
    expect(normalizePDFPage(39,139)).toBe(39);
    expect(normalizePDFPage(9999,139)).toBe(139);
    expect(normalizePDFPage(-1,139)).toBe(1);
    expect(normalizePDFPage(undefined,139)).toBe(1);
  });
  it('moves inside fixed-height reading slices before advancing the PDF', () => {
    expect(stepPDFReflow(1,39,139,0,3)).toEqual({page:39,slice:1,atPreviousPageEnd:false});
    expect(stepPDFReflow(1,39,139,2,3)).toEqual({page:40,slice:0,atPreviousPageEnd:false});
    expect(stepPDFReflow(-1,40,139,0,2)).toEqual({page:39,slice:0,atPreviousPageEnd:true});
    expect(stepPDFReflow(-1,1,139,0,2)).toEqual({page:1,slice:0,atPreviousPageEnd:false});
    expect(stepPDFReflow(1,139,139,1,2)).toEqual({page:139,slice:1,atPreviousPageEnd:false});
  });
  it('does not infer selectable text on an image-only PDF', () => {
    expect(pdfItemsToParagraphs([{str:'',hasEOL:true}])).toEqual([]);
  });
});
