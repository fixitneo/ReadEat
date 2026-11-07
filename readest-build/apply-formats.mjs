#!/usr/bin/env node
// Integrate Readest Personal's Office reading converters into the actual import
// path, reader reopen path, and Android SAF / desktop / folder extension filters.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? 'upstream');
const app = path.join(root, 'apps/readest-app');
const local = path.dirname(new URL(import.meta.url).pathname);
function patch(p, before, after) {
  const file = path.join(app, p);
  const source = fs.readFileSync(file, 'utf8');
  if (source.split(before).length !== 2)
    throw new Error('Format expansion source anchor mismatch: ' + p + ' ' + before.slice(0, 100));
  fs.writeFileSync(file, source.replace(before, after));
}
fs.copyFileSync(path.join(local, 'personalFormatImport.ts'),
  path.join(app, 'src/utils/personalFormatImport.ts'));
fs.copyFileSync(path.join(local, 'personalFormatImport.test.ts'),
  path.join(app, 'src/__tests__/personalFormatImport.test.ts'));

patch('src/services/constants.ts',
  "  'mobi',\n  'azw',",
  "  'mobi',\n  'prc', // Palm MOBI PRC only; other PalmDB encodings remain unsupported.\n  'azw',");
patch('src/services/constants.ts',
  "  'fb2',\n  'zip',",
  "  'fb2',\n  'fbz',\n  'zip',");
patch('src/services/constants.ts',
  "  'txt',\n  'md',",
  "  'txt',\n  'docx',\n  'odt',\n  'rtf',\n  'md',\n  'markdown',");
patch('src/services/constants.ts',
  "  'html',\n  'htm',",
  "  'html',\n  'htm',\n  'xhtml',");

patch('src/libs/document.ts',
  "import type { WidePagesOptions } from '@/utils/spread';",
  "import type { WidePagesOptions } from '@/utils/spread';\n" +
  "import { isPersonalDocument, convertPersonalDocument, isImageOnlyArchive } from '@/utils/personalFormatImport';");

patch('src/libs/document.ts',
  "      name.endsWith('.markdown')",
  "      name.endsWith('.markdown')");

patch('src/libs/document.ts',
  "      name.endsWith('.htm') ||",
  "      name.endsWith('.htm') ||\n      name.endsWith('.xhtml') ||");

patch('src/libs/document.ts',
  "      if (this.isMd()) {",
  "      if (isPersonalDocument(this.filename)) {\n" +
  "        const converted = await convertPersonalDocument(this.file, this.filename);\n" +
  "        return new DocumentLoader(converted).open();\n" +
  "      }\n" +
  "      if (this.isMd()) {");

patch('src/libs/document.ts',
  "        if (this.isCBZ()) {",
  "        // A plain ZIP of image files is a CBZ even when its extension is .zip.\n" +
  "        if (this.isCBZ() || isImageOnlyArchive(entries)) {");

patch('src/services/bookService.ts',
  "import { TxtToEpubConverter } from '@/utils/txt';",
  "import { TxtToEpubConverter } from '@/utils/txt';\n" +
  "import { isPersonalDocument, convertPersonalDocument } from '@/utils/personalFormatImport';");

patch('src/services/bookService.ts',
  "        if (/\\.txt$/i.test(filename)) {\n          const txt2epub = new TxtToEpubConverter();\n          try {\n            ({ file: fileobj } = await txt2epub.convert({ file: fileobj }));",
  "      if (/\\.txt$/i.test(filename) || isPersonalDocument(filename)) {\n" +
  "          const txt2epub = new TxtToEpubConverter();\n" +
  "          try {\n" +
  "            if (isPersonalDocument(filename)) {\n" +
  "              fileobj = await convertPersonalDocument(fileobj, filename);\n" +
  "            } else {\n" +
  "              ({ file: fileobj } = await txt2epub.convert({ file: fileobj }));\n" +
  "            }");

patch('src/services/bookService.ts',
  "      if (/\\.txt$/i.test(filename)) {\n        await fs.writeFile(bookFilename, 'Books', fileobj);",
  "        if (/\\.txt$/i.test(filename) || isPersonalDocument(filename)) {\n" +
  "        // Do not copy the original DOCX/ODT/RTF into the generated .html path.\n" +
  "        await fs.writeFile(bookFilename, 'Books', fileobj);");

patch('src/services/bookService.ts',
  "        if (typeof file === 'string' && !/\\.txt$/i.test(filename)) {",
  "        if (typeof file === 'string' && !/\\.txt$/i.test(filename) && !isPersonalDocument(filename)) {");


patch('src/utils/html.ts',
  "    parsed = new Readability(doc).parse();",
  "    // Converted DOCX/ODT/RTF has already been reduced to safe article\n" +
  "    // markup. Readability can otherwise discard short paragraphs and\n" +
  "    // tables from a structured Office document; keep the complete body.\n" +
  "    parsed = doc.querySelector('meta[name=\"readest-personal-import\"]')\n" +
  "      ? null : new Readability(doc).parse();");

console.log('Readest Personal: DOCX, ODT and RTF content import, PRC and ZIP comic routing applied');
