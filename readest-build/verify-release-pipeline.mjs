#!/usr/bin/env node
// Cheap, offline CI contract for signed data-preserving APK distribution.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/readest-personal-apk.yml','utf8');
assert.match(workflow,/on:\n  workflow_dispatch:/,'APK builds must be manual on private Free Tier');
assert.doesNotMatch(workflow,/\n  push:/,'No per-commit hosted Android rebuilds');
assert.match(workflow,/runs-on: ubuntu-22\.04/,'Must use GitHub-hosted Linux');
assert.doesNotMatch(workflow,/runs-on:.*self-hosted/,'Suspended Oracle runner must not be selected');
assert.match(workflow,/contents: write/,'GITHUB_TOKEN release permissions required');
assert.ok(workflow.includes('ref: '+String.fromCharCode(36)+'{{ github.ref_name }}'),'Must build the requested branch');

const packageId='com.fixitneo.readestpersonal';
assert.ok(workflow.includes(packageId),'Stable package ID missing');
assert.ok(workflow.includes('READEST_ANDROID_KEYSTORE_B64'),'Stable signing secret missing');
assert.ok(workflow.includes('READEST_ANDROID_KEYSTORE_PASSWORD'),'Signing passphrase secret missing');
assert.ok(workflow.includes('readestpersonal'),'Stable signer alias missing');
assert.ok(workflow.includes('apksigner') &&
          workflow.includes('verify --verbose --print-certs'),
          'APK signature verification required');
const pinnedCert=fs.readFileSync('readest-build/ANDROID_SIGNER_CERT_SHA256','utf8').trim();
assert.match(pinnedCert,/^[0-9a-f]{64}$/,'Pinned trusted personal signer digest must be SHA-256');
assert.ok(workflow.includes('readest-build/ANDROID_SIGNER_CERT_SHA256'),
          'Must enforce the trusted signing certificate from successful build #223');
assert.ok(workflow.includes('certificate SHA-256 digest: $expected_cert'),
          'Must reject a different signing certificate before release');
assert.ok(workflow.includes('Number of signers: 1'),'Must require one signer only');
assert.ok(workflow.includes('versionCode = System.getenv("READEST_PERSONAL_VERSION_CODE").toInt()'),
          'Android versionCode must be monotonic');
const versionBase=workflow.match(/READEST_PERSONAL_VERSION_CODE=\$\(\((\d+) \+ GITHUB_RUN_NUMBER\)\)/);
assert.ok(versionBase&&Number(versionBase[1])>=1300000,'Version code must exceed past installed APKs');

const signed=workflow.indexOf('Verify app identifier and collect APK');
const artifact=workflow.indexOf('Upload installable APK');
const release=workflow.indexOf('Automatically publish verified signed APK to GitHub Releases');
assert.ok(signed>0&&artifact>signed&&release>artifact,'Release only AFTER verification and artifact upload');
assert.match(workflow,/gh release create "\$tag"/,'Publish direct APK to GitHub Releases');
assert.match(workflow,/dist\/SHA256SUMS\.txt/,'Provide APK checksum');
assert.match(workflow,/dist\/signing-info\.txt/,'Provide signer certificate metadata');
assert.match(workflow,/--target "\$source_sha"/,'Tag must point to built source revision');
assert.match(workflow,/--latest/,'Mark release latest');
assert.match(workflow,/Do not uninstall|Never uninstall/i,'Upgrade instructions must protect existing data');
console.log('Readest Free Tier + signed in-place-update release workflow: PASS');
