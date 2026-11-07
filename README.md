# ReadEat 1800020

Readest v0.12.20 기반 Android arm64 개인화 버전의 최종 스냅샷입니다.

[APK 다운로드](https://github.com/fixitneo/ReadEat/releases/tag/v1800020)

## 소스와 빌드

readest-build와 .github/workflows/readest-personal-apk.yml에 이 APK에 대응하는 전체 개인화 소스와 재현 가능한 빌드 절차를 포함합니다. 워크플로는 공개 Readest v0.12.16 및 고정된 하위 모듈을 가져온 뒤 최종 v0.12.20 변경과 개인화를 순서대로 적용합니다. 과거 개발 커밋을 가져오지 않은 최종 버전의 빌드 레시피입니다.

빌드에는 Node 24, pnpm 11.1.1, Java 17, NDK 28.2.13676358와 Rust Android aarch64 타깃이 필요합니다. 워크플로에서 요구하는 서명 비밀값은 직접 설정합니다. 배포 APK는 기존 영구키로 서명했습니다. 자체 빌드는 자신의 키로 서명할 수 있습니다.

상세 구현과 빌드는 docs/READEAT_1800020_KO.md를 참고하세요. 최종 APK와 SHA256 및 검증 결과는 Release에 있습니다. 실물 Fold7은 미검증이며 전체 테스트에 기존 정책 차이와 모의 환경 문제가 남아 있습니다.

## 라이선스

GNU AGPL-3.0. Readest 및 각 의존성의 저작권과 라이선스 고지를 유지합니다. 원본은 https://github.com/readest/readest 입니다. 효과음의 출처와 라이선스는 readest-build/PAPER_SOUNDS_LICENSE.md에 있습니다.
