// Repair only the known missing OPF namespace in otherwise readable package XML.
// The archive and chapter bytes remain unchanged; malformed/unknown XML still fails normally.
export function repairEPUBPackageNamespaces(name:string,xml:string):string {
 if(!/\.opf$/i.test(name) || !/\bopf:[\w.-]+\s*=/.test(xml))return xml;
 const parser=new DOMParser();
 const parsed=parser.parseFromString(xml,'application/xml');
 if(!parsed.querySelector('parsererror'))return xml;
 const root=xml.match(/<(?:[A-Za-z_][\w.-]*:)?package\b(?:"[^"]*"|'[^']*'|[^'">])*>/);
 if(!root || /\sxmlns:opf\s*=/.test(root[0]) ||
   !/\sxmlns(?:\:[\w.-]+)?\s*=\s*(["'])http:\/\/www\.idpf\.org\/2007\/opf\1/.test(root[0]))return xml;
 const replacement=root[0].replace(/>$/,' xmlns:opf="http://www.idpf.org/2007/opf">');
 const start=root.index!;
 const fixed=xml.slice(0,start)+replacement+xml.slice(start+root[0].length);
 return parser.parseFromString(fixed,'application/xml').querySelector('parsererror')?xml:fixed;
}
