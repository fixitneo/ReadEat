#!/usr/bin/env node
// Reuse Readest's existing Android native-bridge install_package command,
// replacing only its implementation. Do not fork unrelated native functions.
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]??'.');
const app=path.join(root,'apps/readest-app');
const local=path.dirname(new URL(import.meta.url).pathname);
const native=path.join(app,'src-tauri/plugins/tauri-plugin-native-bridge/android/src/main/java/NativeBridgePlugin.kt');
const original=fs.readFileSync(native,'utf8');
const begin='    @Command\n    fun install_package(invoke: Invoke) {';
const after='    @Command\n    fun set_system_ui_visibility(invoke: Invoke) {';
if(original.split(begin).length!==2||original.split(after).length!==2)
  throw new Error('Readest install_package native anchors changed; refusing an unsafe update patch');
const before=original.indexOf(begin);
const end=original.indexOf(after,before);
if(end<0)throw new Error('Native install_package end not found');
const method=fs.readFileSync(path.join(local,'PersonalInstallPackage.kt.txt'),'utf8');
if(!method.includes('pm.canRequestPackageInstalls()') || !method.includes('archive.packageName == activity.packageName') ||
   !method.includes('existingCerts == newCerts') || !method.includes('nextVersion > currentVersion'))
  throw new Error('Native updater is missing a required security check');
const updated=original.slice(0,before)+method+original.slice(end);
fs.writeFileSync(native,updated);
// Permission exists in upstream v0.12.16, assert it survives scaffold recreation.
const manifest=path.join(app,'src-tauri/gen/android/app/src/main/AndroidManifest.xml');
if(!fs.readFileSync(manifest,'utf8').includes('android.permission.REQUEST_INSTALL_PACKAGES'))
  throw new Error('Android REQUEST_INSTALL_PACKAGES permission missing from upstream manifest');
const src=path.join(app,'src/components/settings/PersonalBackupPanel.tsx');
let ui=fs.readFileSync(src,'utf8');
const importAnchor="import React, { useState } from 'react';";
if(ui.split(importAnchor).length!==2)throw new Error('Backup panel import anchor changed');
ui=ui.replace(importAnchor,importAnchor+"\nimport PersonalApkUpdater from './PersonalApkUpdater';");
const sectionAnchor="  return <div className='mx-auto flex w-full max-w-[680px] flex-col gap-4 px-4 pb-8 pt-5'>";
if(ui.split(sectionAnchor).length!==2)throw new Error('Backup panel UI anchor changed');
ui=ui.replace(sectionAnchor,sectionAnchor+"\n    <PersonalApkUpdater />");
fs.writeFileSync(src,ui);
fs.copyFileSync(path.join(local,'PersonalApkUpdater.tsx'),path.join(app,'src/components/settings/PersonalApkUpdater.tsx'));
console.log('Readest Personal: Android SAF APK picker and verified no-uninstall updater connected');
