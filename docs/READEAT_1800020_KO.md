# ReadEat 1800020

Readest v0.12.20의 Android 앱 변경을 기존 ReadEat 개인화 코드에 병합했다. 공식 태그와 v0.12.16 사이의 286개 커밋을 비교했으며, 개인화 패치 적용 후 apply-readeat20.mjs로 업데이트를 적용한다.

공식 변경 내역은 https://github.com/readest/readest/releases/tag/v0.12.20 에서 확인할 수 있다.

## 사용자 동작

- 책장 상단 + 메뉴는 절대 위치의 오버레이로 열린다. 책장과 헤더의 크기·위치가 유지된다. 책장 안의 추가 타일은 기존 고정 위치 팝업을 사용한다.
- 설명서에서 Android 뒤로가기 또는 Escape를 누르면 확대 이미지, 상세 설명, 설명서 목록 순으로 닫힌다. 목록에서 돌아가면 원래 책장이 보인다. 안내가 닫히면 뒤로가기 가로채기를 해제한다.
- 기본 페이지 효과는 기존 시간·감도 조절을 사용한다. 읽기 화면의 종이 효과 설정에서 네이티브 종이 효과를 켤 수 있다. 해당 엔진에서는 시간·감도를 자체 물리 모델로 계산하므로 관련 슬라이더가 비활성화된다. 새 Page Flip도 선택할 수 있다.
- 검색 기록, 붙여넣은 글 가져오기, 책 묶음 공유, 표지 검색, 사전 팝업 크기 조절, Word Lens 단어 학습 상태와 Anki 연결을 추가했다.
- 기존 도구모음의 ‘단어장에 추가’는 개인 단어장에 저장하며 새 학습 단어장에도 연결된다. 노트 선택 백업에 새 단어장 파일도 포함한다.
- 최신 EPUB·PDF 처리, 주석 병합, ReadEra 분할 백업 읽기, 서버 인증서 옵션, 독서 통계와 동기화 개선을 포함한다.

## 빌드와 재현

패키지 ID는 com.fixitneo.readestpersonal이다. APK는 arm64-v8a이며 versionCode는 1800020이다. 기존 영구 서명 인증서의 SHA-256은 a818800238418223b31d30b4617ed872d867d5532912f5c1104059d15a54c91d이다.

기존 v0.12.16 체크아웃과 1800019까지의 개인화 패치를 순서대로 적용한 뒤 다음 명령을 실행한다.

    node readest-build/apply-readeat20.mjs upstream
    cd upstream
    pnpm install --frozen-lockfile

기존 워크플로의 Android scaffold 복원·패키지 변경·아이콘 설정이 끝난 뒤 네이티브 패치를 적용한다.

    node readest-build/apply-readeat20.mjs upstream --native

Node 24, pnpm 11.1.1, Java 17, NDK 28.2.13676358, Rust aarch64-linux-android 구성을 사용한다. 영구키와 비밀번호는 기존 로컬 보관본에서 읽는다. 기존 앱 위에 업데이트하는 방식으로 배포한다.

readeat20.patch에는 앱과 렌더러의 소스 변경을 기록했다. readeat20-native.patch는 Android manifest와 개인 패키지 MainActivity의 변경이다. readeat20-binary.json의 EPUB은 공식 저장소의 회귀 테스트용 자료다. 사용자가 첨부한 EPUB·PDF·타사 APK는 배포 자료에 포함하지 않았다.

## 검증 범위

테스트 결과와 최종 APK의 해시·서명·설치·다운로드 결과는 Release의 JSON 파일에 기록한다. 기존 개인화 정책과 상위 프로젝트 정책이 다른 테스트는 전체 테스트 결과에서 별도 표기한다.

실물 Fold7, 설치된 AnkiDroid와 외부 사전 앱, 실제 개인 서버, 장시간 배터리 사용은 현장 검증이 필요하다. 현재 배포물은 기존과 같은 개발용 설정의 프리릴리스다.
