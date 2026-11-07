# Readest Personal — one-time Android signing key initialization.
# Execute locally on Windows. Never commit the generated keystore or its base64 text.
$ErrorActionPreference = 'Stop'
$target = Join-Path $env:USERPROFILE 'Documents\ReadestPersonalSigning'
$key = Join-Path $target 'readest-personal.jks'
$base64 = Join-Path $target 'READEST_ANDROID_KEYSTORE_B64.txt'
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw 'Java JDK 17+ keytool is required. Install Temurin JDK 17 and try again.'
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
if (Test-Path $key) {
    throw "A key already exists at $key. Reuse the SAME key for every future update. Do not overwrite it."
}
Write-Host ''
Write-Host 'Generating the permanent Readest Personal signing identity.'
Write-Host 'Choose a strong password. You will enter it again as a GitHub Actions Secret.'
& keytool -genkeypair -keystore $key -storetype PKCS12 -alias readestpersonal -keyalg RSA -keysize 3072 -validity 15000 -dname 'CN=Readest Personal, OU=Private App, O=Personal, C=KR'
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $key)) {
    throw 'keytool failed; a signing key has NOT been prepared.'
}
[System.IO.File]::WriteAllText($base64, [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($key)))
Write-Host ''
Write-Host 'Done. Keep the .jks file backed up offline. Never post it in chats or commit it to Git.'
Write-Host "Keystore file: $key"
Write-Host "Secret 1: READEST_ANDROID_KEYSTORE_B64 (copy ALL the text from $base64)"
Write-Host 'Secret 2: READEST_ANDROID_KEYSTORE_PASSWORD (the password you just chose)'
Write-Host 'Key alias is fixed: readestpersonal'
Write-Host 'GitHub: repository Settings -> Secrets and variables -> Actions -> New repository secret'
