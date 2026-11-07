#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'.');
const app=path.join(root,'apps/readest-app');
const kotlin=fs.readFileSync(path.join(app,'src-tauri/plugins/tauri-plugin-native-bridge/android/src/main/java/NativeBridgePlugin.kt'),'utf8');
const jsx=fs.readFileSync(path.join(app,'src/components/settings/PersonalApkUpdater.tsx'),'utf8');
const panel=fs.readFileSync(path.join(app,'src/components/settings/PersonalBackupPanel.tsx'),'utf8');
const manifest=fs.readFileSync(path.join(app,'src-tauri/gen/android/app/src/main/AndroidManifest.xml'),'utf8');
const requiredNative=[
 'fun install_package(invoke: Invoke)',
 'contentResolver.openInputStream',
 'File.createTempFile(',
 'getPackageArchiveInfo(',
 'archive.packageName == activity.packageName',
 'existingCerts == newCerts',
 'nextVersion > currentVersion',
 'pm.canRequestPackageInstalls()',
 'Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES',
 'FileProvider.getUriForFile(',
 'Intent.ACTION_VIEW',
 'Intent.FLAG_GRANT_READ_URI_PERMISSION',
 'activity.startActivity(intent)',
];
for(const fragment of requiredNative)assert.ok(kotlin.includes(fragment),'Missing required native updater feature: '+fragment);
for(const forbidden of ['uninstallPackage(', 'deletePackage(', 'pm.deletePackage(', 'ACTION_DELETE']) {
  assert.ok(!kotlin.slice(kotlin.indexOf('fun install_package(invoke: Invoke)'),kotlin.indexOf('fun set_system_ui_visibility(invoke: Invoke)')).includes(forbidden),
    'Unsafe uninstall operation in manual updater: '+forbidden);
}
assert.ok(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'),'Missing Android installer permission');
assert.ok(jsx.includes("extensions: ['apk']"),'APK picker must whitelist apk');
assert.ok(jsx.includes('await installPackage({ path: chosen.path })'),'React picker does not dispatch selected APK');
assert.ok(jsx.includes('Android 설치 화면이 열렸습니다'),'UI must not claim installation completed');
assert.ok(panel.includes('<PersonalApkUpdater />'),'Updater control not visible in settings');
const original=fs.readFileSync(path.join(app,'src/components/UpdaterWindow.tsx'),'utf8');
assert.ok(original.length>100,'Original Readest updater was unexpectedly deleted');
console.log('Manual APK updater static checks passed: Android SAF, package, signer, version, user confirmation and data preservation.');
