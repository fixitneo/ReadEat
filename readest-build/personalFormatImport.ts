/**
 * Readest Personal document import bridge.
 *
 * DOCX and ODT are structured ZIP/XML documents; RTF is a control-word stream.
 * Convert to sanitizable HTML before handing off to the existing Readest HTML
 * renderer, instead of merely advertising extensions without a working parser.
 *
 * This is a reading converter (headings, paragraphs, emphasis, basic tables).
 * Complex Office drawings, tracked changes, charts, macros, and OLE objects are
 * not executed or rendered. No network or external Office service is contacted.
 */
const PERSONAL_DOCUMENT_RE = /\.(?:docx|odt|rtf)$/i;
const MAX_SOURCE_SIZE = 100 * 1024 * 1024;
const MAX_XML_BYTES = 32 * 1024 * 1024;
const MAX_PARAGRAPHS = 120_000;

export const isPersonalDocument = (filename: string) =>
  PERSONAL_DOCUMENT_RE.test(filename.replace(/ \(\d+\)$/, ''));

const escaped = (text: string): string => text.replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] ?? m);

const nameOf = (node: Node): string =>
  (node.nodeType === 1 ? (node as Element).localName : null) ??
  node.nodeName.split(':').pop() ?? '';
const isElement = (node: Node): node is Element => node.nodeType === 1;
const children = (node: Node): Element[] =>
  Array.from(node.childNodes).filter(isElement);
const ownChild = (el: Element, tag: string): Element | undefined =>
  children(el).find((child) => nameOf(child) === tag);
const attr = (el: Element, suffix: string): string | undefined =>
  [...el.attributes].find((attribute) =>
    attribute.localName === suffix || attribute.name === suffix)?.value;

function xmlDoc(content: string, label: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('Unsafe Office XML declarations');
  const xml = new DOMParser().parseFromString(content, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length)
    throw new Error('Malformed ' + label + ': invalid XML');
  return xml;
}

const asHtml = (title: string, body: string) =>
  '<!doctype html><html lang="und"><head><meta charset="utf-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
  '<title>' + escaped(title) + '</title><meta name="readest-personal-import" content="converted-office"/></head><body><main>' +
  body + '</main></body></html>';

async function readZipMember(file: File, wanted: string): Promise<string | undefined> {
  // This helper only reads single members. Reusing one reader per document in
  // convertZipDocument avoids re-inflating and repeatedly parsing the directory.
  const { ZipReader, BlobReader, TextWriter } = await import('@zip.js/zip.js');
  const reader = new ZipReader(new BlobReader(file));
  try {
    const files = await reader.getEntries();
    const target = files.find((e) => !e.directory && e.filename === wanted);
    if (!target || target.directory) return undefined;
    if (target.uncompressedSize > MAX_XML_BYTES) throw new Error('Document XML is too large');
    return target.getData(new TextWriter());
  } finally {
    await reader.close();
  }
}

function textFragmentsWord(node: Node): string {
  if (node.nodeType === 3) return '';
  if (!isElement(node)) return '';
  switch (nameOf(node)) {
    case 't': return escaped(node.textContent ?? '');
    case 'tab': return '&emsp;';
    case 'br': case 'cr': return '<br/>';
    case 'noBreakHyphen': return '‑';
    case 'delText': return '';
    case 'instrText': return ''; // Hide fields/macros.
    case 'pPr': case 'rPr': case 'tblPr': case 'trPr': case 'tcPr': return '';
    case 'r': {
      const prop = ownChild(node, 'rPr');
      const bold = !!prop && children(prop).some((child) =>
        nameOf(child) === 'b' && attr(child, 'val') !== '0');
      const italic = !!prop && children(prop).some((child) =>
        nameOf(child) === 'i' && attr(child, 'val') !== '0');
      let body = children(node).map(textFragmentsWord).join('');
      if (bold) body = '<strong>' + body + '</strong>';
      if (italic) body = '<em>' + body + '</em>';
      return body;
    }
    default: return children(node).map(textFragmentsWord).join('');
  }
}

function wordBody(doc: Document): string {
  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  if (!body) throw new Error('DOCX document has no body');
  let count = 0;
  function convert(el: Element): string {
    if (++count > MAX_PARAGRAPHS) throw new Error('Document has too many elements');
    const tag = nameOf(el);
    if (tag === 'p') {
      const paraStyle = ownChild(el, 'pPr');
      const style = paraStyle && ownChild(paraStyle, 'pStyle');
      const kind = style ? (attr(style, 'val') ?? '') : '';
      const heading = /^heading([1-6])$/i.exec(kind.replace(/[\s_-]/g, ''));
      const h = heading ? 'h' + heading[1] : 'p';
      return '<' + h + '>' + children(el).map(textFragmentsWord).join('') + '</' + h + '>';
    }
    if (tag === 'tbl') {
      const rows = children(el).filter((x) => nameOf(x) === 'tr');
      return '<table><tbody>' + rows.map((row) =>
        '<tr>' + children(row).filter((x) => nameOf(x) === 'tc').map((cell) =>
          '<td>' + children(cell).map(convert).join('') + '</td>').join('') + '</tr>').join('') +
          '</tbody></table>';
    }
    return '';
  }
  return children(body).map(convert).join('\n');
}

function odtBody(doc: Document): string {
  const body = doc.getElementsByTagNameNS('*', 'text')[0];
  if (!body) throw new Error('ODT document has no office:text');
  let count = 0;
  function inline(node: Node): string {
    if (node.nodeType === 3) return escaped(node.nodeValue ?? '');
    if (!isElement(node)) return '';
    const tag = nameOf(node);
    if (['annotation','tracked-changes','script'].includes(tag)) return '';
    if (tag === 's') {
      const n = Math.max(1, Math.min(100, Number(attr(node, 'c') ?? '1') || 1));
      return ' '.repeat(n);
    }
    if (tag === 'tab') return '&emsp;';
    if (tag === 'line-break') return '<br/>';
    let out = [...node.childNodes].map(inline).join('');
    if (tag === 'a') out = '<u>' + out + '</u>';
    return out;
  }
  function block(el: Element): string {
    if (++count > MAX_PARAGRAPHS) throw new Error('Document has too many elements');
    const tag = nameOf(el);
    if (tag === 'p' || tag === 'h') {
      const level = Math.min(6, Math.max(1, parseInt(attr(el, 'outline-level') ?? '1') || 1));
      const dest = tag === 'h' ? 'h' + level : 'p';
      return '<' + dest + '>' + [...el.childNodes].map(inline).join('') + '</' + dest + '>';
    }
    if (tag === 'list') {
      return '<ul>' + children(el).filter((e) => nameOf(e) === 'list-item')
        .map((item) => '<li>' + children(item).map(block).join('') + '</li>').join('') + '</ul>';
    }
    if (tag === 'table') {
      return '<table><tbody>' +
        children(el).filter((x) => nameOf(x) === 'table-row').map((r) =>
          '<tr>' + children(r).filter((x) => /table-cell/.test(nameOf(x)))
            .map((cell) => '<td>' + children(cell).map(block).join('') + '</td>').join('') +
          '</tr>').join('') + '</tbody></table>';
    }
    return '';
  }
  return children(body).map(block).join('\n');
}

/** RTF reading fallback: Unicode control words + hex escapes + paragraphs.
 * Does not execute embedded objects or try to interpret binary \bin payloads.
 * RTF text is deliberately escaped before it reaches the HTML renderer. */
function rtfToHtml(rtf: string): string {
  if (!rtf.trimStart().startsWith('{\\rtf'))
    throw new Error('Not an RTF document');
  let text = '', skipGroup = false, skipFallback = 0, uc = 1;
  const stack: { skip: boolean; uc: number }[] = [];
  const hidden = new Set([
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header',
    'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'generator',
    'xmlnstbl', 'listtable', 'listoverridetable', 'datastore', 'themedata',
  ]);
  const cap = 9_000_000;
  // Korean RTF commonly uses \\ansicpg949 with CP949/EUC-KR byte sequences.
  // Decode contiguous escaped bytes together instead of treating each byte
  // as Windows-1252 and corrupting Korean text.
  const codepage = /\\ansicpg(\d+)/.exec(rtf.slice(0, 4096))?.[1];
  const charset = codepage === '949' ? 'euc-kr' :
    codepage === '65001' ? 'utf-8' : 'windows-1252';
  const decoder = new TextDecoder(charset);
  for (let i = 0; i < rtf.length; ) {
    if (text.length > cap) throw new Error('RTF text exceeds safe import limit');
    const ch = rtf[i]!;
    if (ch === '{') {
      stack.push({ skip: skipGroup, uc });
      i++;
      continue;
    }
    if (ch === '}') {
      const prev = stack.pop();
      skipGroup = prev?.skip ?? false;
      uc = prev?.uc ?? 1;
      i++;
      continue;
    }
    if (ch !== '\\') {
      if (!skipGroup && skipFallback === 0 && ch !== '\r' && ch !== '\n') text += ch;
      else if (skipFallback > 0) skipFallback--;
      i++;
      continue;
    }
    const command = rtf.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
    if (command) {
      const [,word,arg] = command;
      i += command[0].length;
      if (hidden.has(word!)) { skipGroup = true; continue; }
      if (word === 'uc') { uc = Math.min(8, Math.max(0, Number(arg) || 0)); continue; }
      if (word === 'bin') { i += Math.min(1_000_000, Math.max(0, Number(arg) || 0)); continue; }
      if (skipGroup) continue;
      if (word === 'u' && arg !== undefined) {
        text += String.fromCharCode((Number(arg) + 65536) & 0xffff);
        skipFallback = uc;
      } else if (word === 'par' || word === 'row') text += '\n';
      else if (word === 'line') text += '\n';
      else if (word === 'tab' || word === 'cell') text += '\t';
      else if (word === 'emdash') text += '—';
      else if (word === 'endash') text += '–';
      else if (word === 'bullet') text += '•';
      else if (word === 'lquote' || word === 'rquote') text += '‘';
      else if (word === 'ldblquote' || word === 'rdblquote') text += '“';
      continue;
    }
    const hex = /^\\'([0-9a-fA-F]{2})/.exec(rtf.slice(i));
    if (hex) {
      const bytes: number[] = [];
      let offset = i;
      while (true) {
        const match = /^\\'([0-9a-fA-F]{2})/.exec(rtf.slice(offset));
        if (!match) break;
        bytes.push(parseInt(match[1]!, 16));
        offset += match[0].length;
        if (bytes.length > 100000) throw new Error('RTF hex byte run is too large');
      }
      if (!skipGroup) {
        const consumed = Math.min(bytes.length, skipFallback);
        skipFallback -= consumed;
        if (bytes.length > consumed)
          text += decoder.decode(new Uint8Array(bytes.slice(consumed)));
      }
      i = offset;
      continue;
    }
    const special = rtf[i + 1];
    if (special === '*' && stack.length) { skipGroup = true; i += 2; continue; }
    if (!skipGroup && skipFallback === 0) {
      if (special === '{' || special === '}' || special === '\\') text += special;
      else if (special === '~') text += '\u00a0';
      else if (special === '-') text += '\u00ad';
    } else if (skipFallback > 0) skipFallback--;
    i += 2;
  }
  if (stack.length !== 0) throw new Error('Truncated or invalid RTF groups');
  const paragraphs = text.replace(/\r/g, '').split('\n');
  return paragraphs.map((p) => '<p>' + escaped(p).replace(/\t/g, '&emsp;') + '</p>').join('\n');
}

export async function convertPersonalDocument(source: File, filename = source.name): Promise<File> {
  const ext = filename.replace(/ \(\d+\)$/, '').split('.').pop()?.toLowerCase();
  if (!ext || !['docx', 'odt', 'rtf'].includes(ext))
    throw new Error('No safe converter for: ' + filename);
  if (source.size > MAX_SOURCE_SIZE) throw new Error('Document exceeds 100 MB safety limit');
  if (source.size < 3) throw new Error('Document is empty or truncated');
  let html: string;
  if (ext === 'rtf') {
    const raw = await source.text();
    html = asHtml(filename.replace(/\.[^.]+$/, ''), rtfToHtml(raw));
  } else {
    const fileToRead = ext === 'docx' ? 'word/document.xml' : 'content.xml';
    const xml = await readZipMember(source, fileToRead);
    if (!xml) throw new Error('Invalid ' + ext.toUpperCase() + ': required XML is missing');
    const doc = xmlDoc(xml, ext.toUpperCase());
    const body = ext === 'docx' ? wordBody(doc) : odtBody(doc);
    if (!body.trim()) throw new Error('No readable paragraphs found');
    html = asHtml(filename.replace(/\.[^.]+$/, ''), body);
  }
  return new File([html], filename.replace(/ \(\d+\)$/, '').replace(/\.(?:docx|odt|rtf)$/i, '.html'), {
    type: 'text/html',
    lastModified: source.lastModified,
  });
}

/** Distinguish a comic-image ZIP from a ZIP with an arbitrary file extension.
 * Generic .zip containing Word XML, source code, or no images must not be
 * silently interpreted as an EPUB or an empty comic. */
export const isImageOnlyArchive = (
  entries: Array<{ filename: string; directory?: boolean }>,
): boolean => {
  const useful = entries.filter((entry) =>
    !entry.directory && !entry.filename.startsWith('__MACOSX/') &&
    !/(?:^|\/)(?:\.DS_Store|Thumbs\.db)$/i.test(entry.filename));
  if (!useful.length) return false;
  return useful.every((entry) => /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i.test(entry.filename));
};
