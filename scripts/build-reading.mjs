import { readFileSync, writeFileSync } from 'node:fs';

// Render the archive's trusted Markdown article without a browser-time dependency.
const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);
const markdown = readFileSync(publicFile('cultural-evolution.md'), 'utf8').trim();
const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(value) {
  return escape(value)
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
const blocks = markdown.split(/\r?\n\s*\r?\n/);
const toc = [];
let section = 0;
let subsection = 0;
const body = blocks.map((block) => {
  if (/^# /.test(block)) return '';
  const heading = block.match(/^(#{2,3}) (.+)$/);
  if (heading) {
    const level = heading[1].length;
    if (level === 2) {
      section += 1;
      subsection = 0;
      toc.push(`<li><a href="#section-${section}">${inline(heading[2])}</a></li>`);
    } else subsection += 1;
    const id = level === 2 ? `section-${section}` : `section-${section}-${subsection}`;
    return `<h${level} id="${id}">${inline(heading[2])}</h${level}>`;
  }
  const lines = block.split(/\r?\n/);
  if (lines.every((line) => line.startsWith('|'))) {
    const cells = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (!cells(lines[1]).every((cell) => /^:?-+:?$/.test(cell))) throw new Error('Invalid table separator');
    const head = cells(lines[0]).map((cell) => `<th scope="col">${inline(cell)}</th>`).join('');
    const rows = lines.slice(2).map((line) => `<tr>${cells(line).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('\n');
    return `<div class="table-scroll" role="region" aria-label="밈 이론과 이중유전 이론 비교표" tabindex="0"><table><caption>밈 이론과 이중유전 이론 비교</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if (lines.every((line) => /^- /.test(line))) return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
  if (lines.every((line) => /^\d+\. /.test(line))) return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
  return `<p>${inline(block.replace(/\r?\n/g, ' '))}</p>`;
}).join('\n');

if (toc.length !== 6 || /최재천|chosun\.com/.test(markdown)) throw new Error('Article sections must exclude the recommendation');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>이기적 유전자와 문화 진화 | 獨樂堂 디지털 아카이브</title>
  <meta name="description" content="유전자 중심 진화관, 이타적 행동, 밈 이론과 이중유전 이론을 사례와 연구 출처로 살펴보는 독락당 읽기 자료입니다.">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="./dusi-reading.css">
  <link rel="stylesheet" href="./cultural-evolution.css">
</head>
<body>
  <a class="skip" href="#reading">본문 바로가기</a>
  <header class="mast"><div class="wrap bar">
    <a class="brand" href="./"><span class="seal" aria-hidden="true">獨</span>獨樂堂 <span>디지털 아카이브</span></a>
    <nav aria-label="아카이브"><a href="./">논어 사유 공간</a><a href="./dusi-reading.html">두시언해 읽기</a></nav>
  </div></header>
  <main id="reading">
    <div class="reading-hero"><div class="wrap">
      <p class="kicker">과학과 사유 · 읽기 자료</p>
      <h1>이기적 유전자와<br>문화 진화</h1>
      <p class="reading-deck">협력은 어떻게 진화하는가.<br>인간이 만든 문화는 어떻게 인간을 바꾸는가.</p>
      <p class="reading-meta">핵심 개념 · 이론 비교 · 연구 사례 · 토론 질문</p>
    </div></div>
    <div class="wrap reading-layout">
      <aside class="reading-toc"><nav aria-label="글 목차"><p>이 글의 순서</p><ol>${toc.join('')}</ol></nav>
        <a class="download" href="./cultural-evolution.md" download>본문 파일 저장</a>
      </aside>
      <article class="reading-body" aria-label="이기적 유전자와 문화 진화 해설">${body}</article>
    </div>
  </main>
  <footer><div class="wrap foot"><div><b>獨樂堂 디지털 아카이브</b><p>고전과 지식을 읽고, 오늘의 질문으로 이어갑니다.</p></div><nav aria-label="글 하단"><a href="#reading">글 처음으로</a><a href="./">아카이브로 돌아가기</a></nav></div></footer>
</body>
</html>
`;
writeFileSync(publicFile('cultural-evolution.html'), html, 'utf8');
console.log(`Reading page generated: ${toc.length} sections`);
