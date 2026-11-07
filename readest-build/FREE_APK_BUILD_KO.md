# Readest Personal — GitHub Free Actions APK 빌드·서명·자동 배포

## 최종 운영 방식 (2026-10)

`fixitneo/localboard`는 **비공개 저장소**로 유지한다. 오라클 자체 Runner는
인스턴스 일시 중지로 사용하지 않으며 APK 워크플로는 `ubuntu-22.04` GitHub
제공 러너만 사용한다. Windows/Oracle/Home Server에 Android Studio, Rust, NDK,
Gradle, APK 빌드 캐시를 유지할 필요가 없다.

- **자동 실행(커밋마다 빌드) 없음:** 무료 분을 소모하지 않도록 `workflow_dispatch`만 활성화.
- **빌드·테스트:** Readest `v0.12.16` 원본 + `readest-personal-v0.12.16` 커스텀 패치 적용.
- **APK 고정 서명:** GitHub Actions Secrets의 동일한 JKS를 매번 사용.
- **검증:** 패키지 ID/증가하는 Android versionCode/서명 인증서/ARM64 라이브러리 확인.
- **배포:** 빌드 성공 시 GitHub Releases에 **APK 직접 업로드**, SHA256, 서명·패키지 정보 자동 등록.
- **임시 산출물:** GitHub Actions 아티팩트도 7일간 보존하며, Releases는 별도로 유지.
- **앱 설치:** 휴대폰에 `.apk` 다운로드 → Android 파일 관리자에서 열기 → 시스템의 **업데이트/설치** 승인.
  앱 내부 **설정 → 백업 · 복원 → 앱 업데이트 → APK 선택하여 업데이트**도 유지.
- **새 서명키 생성 금지:** 기존 설치본과 인증서가 달라지면 삭제 없는 업데이트 불가능.

## 매번 APK를 만드는 순서

1. [Build Readest Personal APK](https://github.com/fixitneo/localboard/actions/workflows/readest-personal-apk.yml) 접속.
2. **Run workflow**를 누르고 가능하면 `readest-personal-v0.12.16` 브랜치 선택.
   코드 체크아웃 단계는 명시적으로 이 브랜치를 가리키므로 기본 브랜치에서 실행해도
   해당 브랜치의 빌드 스크립트를 가져온다.
3. 결제 차단이나 무료 실행 시간 소진이 해제된 상태에서 작업이 시작된다.
   `github-hosted`/ `self-hosted` 선택은 더 이상 없다.
4. `Build arm64 debug APK with persistent personal signature` → `Verify app identifier and collect APK`
   → `Upload installable APK` → `Automatically publish verified signed APK to GitHub Releases`
   단계가 차례로 성공했는지 확인한다.
5. [GitHub Releases](https://github.com/fixitneo/localboard/releases)에서 최신
   `ReadestPersonal_0.12.16_update_<RUN_NUMBER>_arm64.apk` **파일 자체**를 내려받는다.
   Actions 아티팩트 ZIP을 풀 필요가 없다.
6. 휴대폰에서 APK를 열어 시스템 설치 창의 **업데이트/설치**를 승인한다.
   보안 설정에서 설치 출처를 허용하라는 안내가 나오면 해당 파일 관리자/브라우저만 허용한다.
7. Readest의 독서 위치·주석·서버 설정 등이 유지되는지 실기기에서 확인한다.
   대규모 버전 변경 전에는 **선택형 ZIP 백업**을 별도 저장한다.

> GitHub 저장소가 비공개이므로 Release와 APK 다운로드에는 저장소 접근 권한이
> 있는 GitHub 계정 로그인이 필요하다. APK 파일 자체를 내려받아 설치하는
> 과정에는 Android Studio나 GitHub 앱이 필요하지 않다.

## 삭제 없는 Android 업데이트가 되는 조건

1. 설치된 앱과 새 APK의 `applicationId`가 `com.fixitneo.readestpersonal`로 동일해야 한다.
2. 앱 서명 인증서가 **기존 개인 JKS**와 동일해야 한다. Alias: `readestpersonal`.
3. 새 `versionCode`가 기존보다 높아야 한다.
   이전 성공 빌드보다 높은 값이 되도록 워크플로는 `1300000 + GITHUB_RUN_NUMBER`를 사용한다.
4. Android 자체 패키지 설치 관리자에서 사용자 확인이 필요하다.
   **사용자의 승인 없이 무음/백그라운드 강제 설치는 하지 않는다.**

기존 앱이 한때 **다른 서명 키**로 만들어졌다면 새 개인 APK를 바로 덮어쓸 수 없다.
`INSTALL_FAILED_UPDATE_INCOMPATIBLE` 경고가 나오면 **절대로 앱을 먼저 삭제하지 말고**,
기존 앱 내 백업을 완료한 뒤 서명/패키지 정보를 비교한다.

## 요금과 저장공간

- GitHub Free 비공개 저장소에서 표준 GitHub-hosted runner 무료 분(일반적으로 월 2,000분)이
  제공되지만, **무제한이 아니다**. 실제 남은 분량과 계정 제한은 Billing에서 확인.
- 자동 빌드는 꺼져 있다. **필요한 때만 수동 실행**해야 무료 예산을 관리할 수 있다.
- GitHub Actions 아티팩트는 7일 후 만료되지만 GitHub Release는 별도이며
  Release 자산의 수명/계정 정책 및 저장 용량은 GitHub 정책에 따른다.
- `Budgets and alerts`의 $0 유료 예산을 바꾸지 않는 것이 무료 사용 원칙이다.
- 월별 무료 할당량이 리셋되더라도 **결제 연체 등의 별도 제한이 있다면** 실행이 차단될 수 있다.
- 기존 Oracle Runner가 나중에 복구돼도 이번 APK 워크플로에서는 선택되지 않는다.
  대기 중이었던 이전 `#226` 실행은 UI에서 **Cancel workflow**로 취소하는 것을 권장한다.

## 서명키 관리

- GitHub Secrets `READEST_ANDROID_KEYSTORE_B64`
  및 `READEST_ANDROID_KEYSTORE_PASSWORD`를 그대로 보관한다.
- 기존 로컬 `.jks`를 재생성하거나 교체하지 않는다.
- 이 비밀키/비밀번호는 커밋·릴리즈 첨부 파일·포럼·대화에 올리지 않는다.
- Releases에는 **공개 정보**인 인증서 지문과 패키지 정보만 첨부하고 키 자체는 게시하지 않는다.

관련 문서: `readest-build/ANDROID_UPDATES_KO.md`.

GitHub 공식 문서:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-syntax
- https://cli.github.com/manual/gh_release_create
