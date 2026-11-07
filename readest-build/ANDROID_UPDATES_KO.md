# Readest Personal: 삭제 없이 업데이트하기

## 앱 내부에서 APK를 선택하는 업데이트 (새로운 기본 방식)

**설정 → 백업 · 복원 → 앱 업데이트 → APK 선택하여 업데이트**에서 휴대폰에 저장한 최신
`.apk`를 선택한다. Android 파일 선택기의 `content://` 주소도 지원한다.

앱 내부 Android 네이티브 브리지가 APK 파일을 임시 캐시에 복사하고 다음을 검사한다.

1. 설치된 앱의 패키지 ID `com.fixitneo.readestpersonal`과 정확히 일치
2. 설치된 앱과 동일한 APK 서명 인증서
3. 지금 설치된 버전보다 **높은** Android `versionCode`

조건을 만족하면 Android 설치 확인 화면이 나타난다. **설치 허용은 사용자가 직접**
눌러야 하며 앱은 자동으로 제거하거나 데이터를 초기화하지 않는다.
'이 출처의 앱 허용' 요청을 받은 경우 앱 권한 설정에서 허용하고 다시 APK를 선택한다.
Android는 정상적인 동일 앱 업데이트에서는 앱 내부 데이터를 유지한다.

> 첫 개인 서명 APK가 **이미 설치된 임시 디버그 APK와 서명이 다르다면**,
> 앱 내 업데이트도 불가능하다. 버튼은 '서명 불일치' 메시지를 보여주며 기존
> 설치본을 지우지 않는다. Android 정책상 기존 앱 데이터를 서명이 다른 APK로
> 직접 이주시킬 방법이 없다. 처음 전환할 때만 기존 설치본의 백업/복원 또는
> 이전 서명키 확보가 필요하다. 그 이후 서명키를 고정하면 수동 ZIP 백업 없이
> 업데이트할 수 있다.

원본 Readest의 자동 다운로드 업데이트 대신 개인 앱에 맞는 **선택형 로컬 APK
설치** 흐름이다. APK 선택 시 파일명만 믿지 않고 실제 Android 패키지 정보를 검사한다.


이 저장소의 `readest-personal-v0.12.16` 빌드 브랜치와 `.github/workflows/readest-personal-apk.yml`은
고정 패키지 `com.fixitneo.readestpersonal` 및 고정 개인 서명 키를 사용하도록 설계한다.

## 1. 기존 데이터부터 백업

기존 설치 앱에서 **설정 → 백업 · 복원 → 모두 선택(비밀번호 제외) → 내보내기**를 실행한다.
암호/토큰을 백업하지 않았다면 서버 로그인은 전환 직후 한 번 다시 입력해야 할 수 있다.
ZIP 파일을 Android 앱 외부(PC, NAS 등)에 복사해 확인한다.
GitHub Actions에서 빌드한 기존 임시 디버그 APK의 서명 개인키는 복구할 수 없다.
서명이 달라지는 최초 전환에는 기존 앱을 삭제하고 새로 설치해야 할 수 있으며,
삭제하면 내부 앱 데이터가 소실되므로 반드시 백업 ZIP을 외부에 저장한다.

## 2. 개인 서명 키 생성 (최초 1회)

Windows PowerShell에서 JDK 17 이상을 준비하고 `create-signing-key.ps1`을 실행한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\readest-build\create-signing-key.ps1
```

`Documents\ReadestPersonalSigning\`에 다음 파일이 생성된다.
- `readest-personal.jks` — 평생 보관할 비밀 키. PC + 별도의 오프라인 백업 두 군데에 보존
- `READEST_ANDROID_KEYSTORE_B64.txt` — 키를 GitHub Secret에 등록하기 위한 텍스트

*GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret*에 정확히 두 개를 등록한다.

| Secret | 값 |
|---|---|
| `READEST_ANDROID_KEYSTORE_B64` | 텍스트 파일 전체 내용 |
| `READEST_ANDROID_KEYSTORE_PASSWORD` | 키 생성 과정에서 본인이 정한 암호 |

별도의 alias 설정은 필요 없다. 앱은 `readestpersonal` 별칭을 사용한다.
키와 암호를 저장소 파일, Actions 로그, 일반 채팅, 공개 서버에 올리지 않는다.
비밀 키를 잃어버리면 같은 앱에 대한 서명 업데이트를 계속할 수 없으므로 **키 백업은 필수**.

## 3. GitHub 무료 Actions → 자동 서명 → Releases 자동 배포

1. [Build Readest Personal APK](https://github.com/fixitneo/localboard/actions/workflows/readest-personal-apk.yml)
   → **Run workflow** → 브랜치 `readest-personal-v0.12.16`을 선택한다.
   이 워크플로는 `ubuntu-22.04` GitHub 제공 러너만 사용한다.
   커밋마다 자동 빌드하지 않으므로 Free 계정의 남은 Actions 분량 내에서
   필요한 때만 수동 실행한다.
2. 코드와 테스트, Android 컴파일, **기존 영구 JKS를 사용한 서명**, 패키지/버전 검사,
   서명 인증서 지문 일치 검사가 모두 성공하면 자동으로 GitHub Releases에 APK를 게시한다.
3. [GitHub Releases](https://github.com/fixitneo/localboard/releases)에서 최신 릴리스의
   `ReadestPersonal_0.12.16_update_<RUN_NUMBER>_arm64.apk` 파일을 선택한다.
   `Source code.zip`이 아니라 **.apk 파일**을 다운로드한다.
4. Android 휴대폰의 **내 파일 / 다운로드**에서 APK를 탭한다.
   Android 시스템 설치 화면에서 **업데이트** 또는 **설치**를 승인한다.
   기존 앱을 삭제하거나 저장 공간 데이터를 지우지 않는다.
5. 필요하면 Readest 내부 **설정 → 백업 · 복원 → 앱 업데이트 → APK 선택하여 업데이트**를
   이용할 수도 있다. 이 기능은 APK 서명·패키지·버전을 먼저 검사한다.

비공개 GitHub 저장소이므로 Releases 조회·다운로드에는 해당 저장소에 접근할 수 있는
GitHub 계정 로그인이 필요하다. APK를 내려받은 후 설치 시에는 GitHub 연결이 필요하지 않다.

### 기존 앱과 동일한 서명 인증서 고정

실제로 서명되어 성공했던 **APK 빌드 #223**의 인증서 SHA-256 지문을
`readest-build/ANDROID_SIGNER_CERT_SHA256`에 고정해 두었다.
새 APK는 빌드에서 이 값과 실제 서명 인증서를 **정확히 대조**한다.
다른 JKS/개인키가 사용되면 즉시 실패하고 Releases에 잘못된 APK를 게시하지 않는다.
이 인증서 지문은 공개 정보이며 **JKS 개인키나 암호가 아니다.**

패키지 ID는 `com.fixitneo.readestpersonal`로 고정되고,
Android `versionCode`는 `1300000 + GITHUB_RUN_NUMBER`로 증가하도록 설정됐다.
이전 성공 빌드 #223의 `versionCode=1000223`보다 높은 값이다.

> 중요한 예외: **현재 휴대폰에 설치된 Readest 앱이 #223과 다른 서명키로 설치된 상태**라면
> 새 APK가 이를 직접 덮어쓸 수 없다. 이 경우에도 기존 앱을 먼저 삭제하지 말고,
> 설치본의 서명과 데이터 백업을 확인한 뒤 마이그레이션을 결정한다.
> 이미 동일한 개인 서명으로 설치되어 있다면 일반 APK 업데이트로 데이터가 유지된다.

### 배포 후 보관

- APK 직접 다운로드: GitHub Releases (작업에서 자동 게시)
- 임시 Actions 아티팩트 ZIP: 7일 보관
- `SHA256SUMS.txt`: 릴리스 APK 파일 무결성 확인
- `signing-info.txt`: 검증한 서명 인증서 정보
- `package-info.txt`: 앱 ID/버전/SDK 정보

앱 내 업데이트 알림이나 무인 백그라운드 설치는 아직 구현하지 않았다.
Android 보안 정책상 **사용자가 시스템 설치 화면에서 승인**해야 한다.

## 원칙 / 제한
- 앱을 삭제하거나 앱 데이터 지우기를 누르면 Android 내부 데이터는 남지 않는다.
- 외부 서버에 실제로 존재하는 파일은 앱 APK 업데이트와 무관하다. 서버 주소/계정 설정은 동일 패키지 데이터 영역에 남는다.
- `run_number`의 일관성은 이 워크플로 파일을 유지하는 전제다. 워크플로를 삭제/재생성하여 번호가 초기화되면 Android 버전 코드도 적절히 조정해야 한다.
- 빌드에서 비밀 키 누락·서명 불일치가 발생하면 APK 배포가 실패한다. 임시 디버그 APK로 대체하지 않는다.
- **앱 내부 자동 업데이트 알림/다운로드는 아직 구현하지 않았다.** APK 파일을 열면 Android 시스템 설치 관리자가 업데이트를 처리한다.
