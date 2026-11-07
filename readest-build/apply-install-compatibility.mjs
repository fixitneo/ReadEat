#!/usr/bin/env node
// Run after Android scaffold restoration, before tauri android build.
import fs from 'node:fs';
import path from 'node:path';
const file=path.resolve(process.argv[2]??'upstream','apps/readest-app/src-tauri/gen/android/app/build.gradle.kts');
let code=fs.readFileSync(file,'utf8');
if(!code.includes('jniLibs.useLegacyPackaging = true')) {
  const anchor='android {\n';
  if(code.split(anchor).length!==2)throw new Error('Unexpected Android Gradle configuration');
  code=code.replace(anchor,anchor+'    // Use extracted native libraries for the compatibility installation path.\n    packaging {\n        jniLibs.useLegacyPackaging = true\n    }\n');
  fs.writeFileSync(file,code);
}
console.log('Native libraries will be compressed in APK and extracted by Android during installation.');
