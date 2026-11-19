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
- **두시언해 읽기**에서 「추흥」 기일·기이·기삼의 구절별 해설을 읽습니다.
- **권별 목차** 또는 `#dusi`에서 확인 상태별로 권을 선택하면 공식 목차가 열립니다.
- **이기적 유전자와 문화 진화**에서 유전자 중심 진화관, 밈과 이중유전 이론을 읽습니다. 목차 이동, 비교표, 연구 출처와 본문 다운로드를 제공합니다.

## 과학과 사유 읽기 자료

`public/cultural-evolution.md`가 「이기적 유전자와 문화 진화」의 원문입니다. `npm run build`에서 `scripts/build-reading.mjs`가 정적 읽기 페이지를 생성합니다. 원문 수정 후 빌드를 실행하면 `public/cultural-evolution.html`과 배포 파일이 갱신됩니다. 개발 중에는 `node scripts/build-reading.mjs`로 페이지를 다시 생성할 수 있습니다.

## 데이터와 시각 자산

`public/data/analects_data.json`은 제공된 명세의 데이터를 보존합니다. 세 개념과 네 시대의 12개 해석, 큐레이터 글, 현대적 성찰 자료가 포함되어 있습니다. 현재 탐색 화면은 명세의 세 개념 및 시대별 주석 화면을 구현합니다.

두시언해의 작품별 목차와 현대어 제목을 모은 데이터는 공개를 보류했습니다. 사이트에는 권차별 공식 링크와 독락당의 작품 해설을 제공합니다.

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
