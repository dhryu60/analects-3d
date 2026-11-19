# The Living Analects 3D · 論語 입체 사유 공간

獨樂堂 디지털 아카이브 — Three.js, TypeScript, Vite로 구현한 논어의 시대별 해석 탐색 공간입니다.

## 실행 및 검증

Node.js 22 이상에서 실행합니다.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

`npm run build`는 TypeScript 엄격 검사를 먼저 수행하고 정적 배포 파일을 `dist/`에 만듭니다.

## 사용 방법

- 상단에서 仁(인), 禮(예), 君子(군자)를 선택합니다.
- 네 시대의 비석 또는 하단 시대 버튼을 선택하면 원문·번역·해석·주석이 열립니다.
- 마우스 드래그로 회전하고 휠 또는 두 손가락으로 확대·축소합니다.
- 닫기 버튼 또는 Esc로 전체 공간으로 돌아갑니다. 시대 버튼은 키보드로도 이용할 수 있습니다.
- 운영체제의 동작 줄이기 설정을 존중합니다.
- 하단 음악 버튼으로 BWV 106 소나티나를 재생·일시정지하고, 음량을 조절합니다. 첫 접속 시 자동 재생하지 않으며, 재생 후에는 반복됩니다. 일시정지 후 재생하면 같은 위치에서 이어집니다.
- 상단 **두시언해 자료 탐색**을 누르면 권차 선택과 작품 목록이 열립니다. `#dusi` 주소로 바로 열 수도 있습니다.
- 권차·목차 확인 상태를 선택하고 제목·한자·주제 분류·링크 확인 근거로 작품을 찾습니다. 40개씩 페이지를 나누며, 작품과 공식 목차는 새 탭에서 열립니다.
- 목차 직접 확인·검색 일부 확인·목차 미확인을 구분하고, 작품별 본문 미확인·검색 발췌 확인·본문 공백을 별도로 표시합니다. 미확인 자료는 작품이 없는 것으로 표시하지 않습니다.
- 모바일에서는 권차 선택 메뉴를 사용합니다. 탐색 닫기 또는 Esc로 논어 화면으로 돌아옵니다.

## 데이터와 시각 자산

`public/data/analects_data.json`은 제공된 명세의 데이터를 보존합니다. 세 개념과 네 시대의 12개 해석, 큐레이터 글, 현대적 성찰 자료가 포함되어 있습니다. 현재 탐색 화면은 명세의 세 개념 및 시대별 주석 화면을 구현합니다.

세종한글고전 『분류두공부시언해』의 외부자료 연결 메타데이터는 [metadata.json](public/data/sejong-dusi/metadata.json)에 있습니다. [권별 검토 목록](public/data/sejong-dusi/catalog.html)과 [필드 설명](public/data/sejong-dusi/README.txt)을 함께 제공합니다. 2026년 11월 19일 관찰한 자료 29개 중 목차 16개를 직접 확인했으며, 작품 링크는 직접 목차 612개와 공식 검색 자료 7개로 구분했습니다. 목차 확인과 본문 확인은 별도 상태이며, 미확인 자료를 완전한 목록으로 표시하지 않습니다. [src/dusi.ts](src/dusi.ts)의 탐색 화면은 이 파일을 열 때 불러오며, 실패하면 재시도를 제공합니다. `python -X utf8 scripts/build_sejong_dusi_metadata.py`로 보존한 관찰 원자료에서 파일을 재생성하고 무결성을 검사할 수 있습니다.

서예 카드와 비석 텍스처는 명세처럼 Canvas로 생성되며 별도 이미지 파일 없이 동작합니다. 데이터의 `calligraphyTexture`는 향후 외부 자산을 위한 메타데이터입니다.

배경음악은 Ralph Looij의 2022년 BWV 106 소나티나 오르간 연주판(Alexandre Guilmant 편곡, 약 3분 9초)입니다. [IMSLP #815098](https://imslp.org/wiki/Special:ReverseLookup/815098)에서 내려받은 MP3를 `public/assets/audio/bwv106_sonatina.mp3`에 원본 그대로 포함했습니다. [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)에 따라 비상업적 아카이브 배경음악으로 사용하며 화면에 연주자·출처·라이선스를 표시합니다. 이 녹음의 상업적 사용은 허용 범위에 포함되지 않습니다. 출처와 파일 해시는 `public/assets/audio/ATTRIBUTION.txt`에 기록되어 있습니다.

역사 설명과 인용문은 첨부 명세를 그대로 옮겼으며 별도의 원전 대조를 수행하지 않았습니다.

## GitHub Pages 배포

- 저장소: https://github.com/dhryu60/analects-3d
- 배포 주소: https://dhryu60.github.io/analects-3d/
- Pages의 Source는 **GitHub Actions**로 설정합니다.
- `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 `npm ci`, 타입 검사, Vite 빌드 후 Pages에 배포합니다.
- Actions 탭에서 수동 실행도 가능합니다.
- Vite의 상대 경로(`base: './'`)와 상대 데이터 경로를 사용하여 저장소 하위 경로에서 실행됩니다.

## 명세 코드에서 보완한 사항

카메라 자동 이동 중에만 보간하여 사용자 회전·확대 조작과의 충돌을 해소했습니다. 클릭과 드래그를 구분하고 로딩 중 입력을 방지하며 데이터 로딩/WebGL 실패 메시지를 제공합니다. 개념 전환 때 이전 GPU 텍스처를 해제하고, 비석 글자를 폭에 맞추며, 모바일 레이아웃과 키보드 탐색을 보완했습니다.
