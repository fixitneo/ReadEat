import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {repairEPUBPackageNamespaces} from '@/utils/personalEPUBRepair';
import {DocumentLoader} from '@/libs/document';
vi.mock('foliate-js/paginator.js',()=>({}));
const broken='<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator opf:role="aut">Author</dc:creator></metadata><manifest/><spine/></package>';
describe('conservative OPF namespace repair',()=>{
 it('repairs missing standard OPF namespace and keeps author metadata',()=>{
  expect(new DOMParser().parseFromString(broken,'application/xml').querySelector('parsererror')).toBeTruthy();
  const fixed=repairEPUBPackageNamespaces('OPS/content.opf',broken);
  const doc=new DOMParser().parseFromString(fixed,'application/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.getElementsByTagNameNS('*','creator')[0]?.getAttributeNS('http://www.idpf.org/2007/opf','role')).toBe('aut');
 });
 it('preserves an already valid declaration byte for byte',()=>{
  const valid=broken.replace('<package ','<package xmlns:opf="http://www.idpf.org/2007/opf" ');
  expect(repairEPUBPackageNamespaces('content.opf',valid)).toBe(valid);
 });
 it('never repairs unknown namespaces or malformed XML by guessing',()=>{
  const unknown=broken.replace('opf:role','unknown:role');
  expect(repairEPUBPackageNamespaces('content.opf',unknown)).toBe(unknown);
  const malformed=broken.replace('</metadata>','');
  expect(repairEPUBPackageNamespaces('content.opf',malformed)).toBe(malformed);
 });
 it('does not rewrite chapter files or unknown package formats',()=>{
  expect(repairEPUBPackageNamespaces('chapter.xhtml',broken)).toBe(broken);
  const unknown=broken.replace('http://www.idpf.org/2007/opf','urn:other');
  expect(repairEPUBPackageNamespaces('content.opf',unknown)).toBe(unknown);
 });
});
const actual=process.env['READEST_TEST_EPUB'];
it.skipIf(!actual)('opens the supplied EPUB and parses every source section',async()=>{
 const bytes=new Uint8Array(readFileSync(actual!));
 const file=new File([bytes],'provided.epub',{type:'application/epub+zip'});
 const {book,format}=await new DocumentLoader(file).open();
 expect(format).toBe('EPUB');expect(book.metadata.title).toBe('위버멘쉬');
 expect(book.sections.length).toBeGreaterThan(10);
 let readable=0;
 for(const section of book.sections){
  const doc=await section.createDocument();
  expect(doc.querySelector('parsererror'),section.href).toBeNull();
  if(doc.body?.textContent?.trim())readable++;
 }
 expect(readable).toBeGreaterThan(10);
 const cover=await book.getCover?.();expect(cover?.size).toBeGreaterThan(0);
 console.log('Provided EPUB opened:',book.sections.length,'sections;',readable,'nonempty sections; cover loaded.');
},30000);
