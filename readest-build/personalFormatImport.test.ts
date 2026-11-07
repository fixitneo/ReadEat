import { describe, expect, it } from 'vitest';
import { ZipWriter, BlobWriter, TextReader } from '@zip.js/zip.js';
import {
  isPersonalDocument, isImageOnlyArchive, convertPersonalDocument,
} from '@/utils/personalFormatImport';

const zipFile = async (entries: Record<string, string>, name: string): Promise<File> => {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [filename, data] of Object.entries(entries)) {
    await writer.add(filename, new TextReader(data));
  }
  const blob = await writer.close();
  return new File([blob], name, { type: 'application/zip' });
};

describe('Readest Personal extended formats', () => {
  it('accepts office files and RTF, rejects unrelated extensions', () => {
    expect(isPersonalDocument('Author.docx')).toBe(true);
    expect(isPersonalDocument('thesis.ODT (2)')).toBe(true);
    expect(isPersonalDocument('notes.rtf')).toBe(true);
    expect(isPersonalDocument('random.zip')).toBe(false);
  });

  it('converts DOCX structured paragraphs, text formatting, and tables into readable HTML', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title &amp; Test</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t> line</w:t></w:r></w:p>
          <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        </w:body>
      </w:document>`;
    const docx = await zipFile({ 'word/document.xml': xml }, 'test.docx');
    const html = await convertPersonalDocument(docx);
    const text = await html.text();
    expect(html.name).toBe('test.html');
    expect(text).toContain('<h1>Title &amp; Test</h1>');
    expect(text).toContain('<strong>Bold</strong>');
    expect(text).toContain('<table><tbody><tr><td>');
    expect(text).not.toContain('<script');
  });

  it('converts ODT paragraphs, headings and list elements without scripts', async () => {
    const xml = `<?xml version="1.0"?>
      <office:document-content
        xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
        <office:body><office:text><text:h text:outline-level="2">Chapter</text:h>
          <text:p>Text &amp; notes</text:p>
          <text:list><text:list-item><text:p>First</text:p></text:list-item></text:list>
        </office:text></office:body>
      </office:document-content>`;
    const odt = await zipFile({ 'content.xml': xml }, 'chapter.odt');
    const html = await convertPersonalDocument(odt);
    const output = await html.text();
    expect(output).toContain('<h2>Chapter</h2>');
    expect(output).toContain('<p>Text &amp; notes</p>');
    expect(output).toContain('<li><p>First</p></li>');
  });

  it('extracts RTF Unicode safely and does not display font-table noise', async () => {
    const rtf = String.raw`{\rtf1\ansi\uc1{\fonttbl{\f0 Arial;}}Hello \u49464?\u44032?\par Next line.}`;
    const html = await convertPersonalDocument(new File([rtf], 'sample.rtf'));
    const output = await html.text();
    expect(output).toContain('Hello');
    expect(output).toContain('세');
    expect(output).toContain('<p>Next line.</p>');
    expect(output).not.toContain('Arial');
  });

  it('decodes CP949 Korean escaped RTF text instead of mojibake', async () => {
    const korean = String.raw`{\rtf1\ansi\ansicpg949 \'C7\'D1\'B1\'DB\par Done.}`;
    const result = await convertPersonalDocument(new File([korean], 'korean.rtf'));
    expect(await result.text()).toContain('한글');
  });

  it('rejects mislabeled Office ZIPs instead of claiming to read them', async () => {
    const file = await zipFile({ 'other.xml': '<test/>' }, 'bad.docx');
    await expect(convertPersonalDocument(file)).rejects.toThrow('required XML is missing');
  });

  it('identifies image-only .zip archives as comic books', () => {
    expect(isImageOnlyArchive([{ filename: '0001.webp' }, { filename: '0002.png' }])).toBe(true);
    expect(isImageOnlyArchive([{ filename: 'word/document.xml' }, { filename: 'image.png' }])).toBe(false);
    expect(isImageOnlyArchive([{ filename: '__MACOSX/foo' }, { filename: 'folder/001.jpg' }])).toBe(true);
    expect(isImageOnlyArchive([])).toBe(false);
  });
});
