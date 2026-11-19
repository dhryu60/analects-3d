import './dusi.css';

type TocStatus = 'direct_toc_observed' | 'partial_search_only' | 'unverified';
type Evidence = 'direct_toc_observed' | 'search_index_observed';
interface Volume {
  book_code: string; title_raw: string; toc_url: string; toc_status: TocStatus;
  imported_work_entry_count: number | null; known_search_work_link_count: number;
  observed_categories: Array<{ title_raw: string }>;
}
interface Entry {
  id: string; book_code: string; kind: string; title_raw: string; url: string;
  category_path: string[]; verification: Evidence; body_status: string;
}
interface Catalog {
  schema_version: string; observed_date: string; volumes: Volume[]; entries: Entry[];
  source: { catalog_url: string };
  counts: { listed_book_units: number; directly_observed_tocs: number; total_linked_work_entries: number };
}

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dialog = get<HTMLDialogElement>('dusi-dialog');
const opener = get<HTMLButtonElement>('open-dusi');
const browser = get('dusi-browser');
const loading = get('dusi-loading');
const retry = get<HTMLButtonElement>('dusi-retry');
const query = get<HTMLInputElement>('dusi-query');
const category = get<HTMLSelectElement>('dusi-category');
const tocStatus = get<HTMLSelectElement>('dusi-toc-status');
const evidence = get<HTMLSelectElement>('dusi-evidence');
const volumeSelect = get<HTMLSelectElement>('dusi-volume-select');
const results = get('dusi-results');
const PAGE_SIZE = 40;
let data: Catalog | null = null;
let loadingData = false;
let selectedBook = 'all';
let page = 1;

const tocLabels: Record<TocStatus, string> = {
  direct_toc_observed: '목차 직접 확인', partial_search_only: '검색 일부 확인', unverified: '목차 미확인',
};
const bodyLabels: Record<string, string> = {
  not_inspected: '본문 미확인', header_only_body_blank: '상세 제목 확인·본문 공백', search_excerpt_seen: '본문 검색 발췌만 확인',
};
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function external(url: string, title: string): HTMLAnchorElement {
  const link = el('a', title);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'db.sejongkorea.org') throw new Error('Unexpected source URL');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = '세종한글고전에서 새 탭으로 열기';
  return link;
}
function statusTag(label: string, kind: string): HTMLElement {
  return el('span', label, `dusi-status ${kind}`);
}
function tocTag(status: TocStatus): HTMLElement {
  return statusTag(tocLabels[status], status === 'direct_toc_observed' ? 'direct' : status === 'partial_search_only' ? 'search' : 'unknown');
}
function shortTitle(volume: Volume): string { return volume.title_raw.replace('역주 분류두공부시언해 ', ''); }
function visibleVolumes(): Volume[] {
  return data!.volumes.filter(v => tocStatus.value === 'all' || v.toc_status === tocStatus.value);
}
function currentVolume(): Volume | undefined { return data?.volumes.find(v => v.book_code === selectedBook); }
function scopedWorks(): Entry[] {
  const books = new Set(visibleVolumes().map(v => v.book_code));
  return data!.entries.filter(e => e.kind === 'work' && books.has(e.book_code) && (selectedBook === 'all' || e.book_code === selectedBook));
}
function renderVolumes(): void {
  const volumes = visibleVolumes();
  get('dusi-volume-count').textContent = `${volumes.length}개 자료 표시 / 전체 ${data!.volumes.length}개`;
  const list = get('dusi-volume-list');
  list.replaceChildren();
  volumeSelect.replaceChildren(new Option('전체 작품', 'all'));
  function addButton(code: string, title: string, state?: TocStatus): void {
    const button = el('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selectedBook === code));
    button.append(el('span', title));
    if (state) button.append(tocTag(state));
    button.addEventListener('click', () => selectBook(code));
    list.append(button);
  }
  addButton('all', '전체 작품');
  for (const volume of volumes) {
    addButton(volume.book_code, shortTitle(volume), volume.toc_status);
    volumeSelect.add(new Option(`${shortTitle(volume)} · ${tocLabels[volume.toc_status]}`, volume.book_code));
  }
  volumeSelect.value = selectedBook;
}
function renderCategories(): void {
  const previous = category.value;
  const names = new Set<string>();
  const volumes = selectedBook === 'all' ? visibleVolumes() : [currentVolume()!];
  for (const volume of volumes) for (const item of volume.observed_categories) names.add(item.title_raw);
  category.replaceChildren(new Option('모든 분류', 'all'));
  for (const name of names) category.add(new Option(name, name));
  category.value = names.has(previous) ? previous : 'all';
}
function renderSummary(): void {
  const volume = currentVolume();
  const box = get('dusi-volume-summary');
  box.replaceChildren(el('h2', volume ? `${shortTitle(volume)} 목차` : '전체 작품 둘러보기'));
  const line = el('div', '', 'dusi-summary-links');
  if (volume) {
    line.append(tocTag(volume.toc_status), external(volume.toc_url, '공식 권별 목차'));
    box.append(line);
    const count = volume.imported_work_entry_count;
    box.append(el('p', count === null
      ? `전체 목차 미확인 · 검색에서 확인한 작품 링크 ${volume.known_search_work_link_count}개`
      : `직접 확인한 목차의 작품 항목 ${count}개`, 'dusi-summary-copy'));
    if (volume.toc_status === 'partial_search_only') {
      box.append(el('p', '공식 검색 자료에서 확인한 일부 분류·작품만 표시합니다. 이 권의 전체 목차가 아닙니다.', 'dusi-notice'));
    }
  } else {
    const c = data!.counts;
    box.append(el('p', `${c.listed_book_units}개 자료 중 목차 ${c.directly_observed_tocs}개 직접 확인 · 수록 작품 링크 ${c.total_linked_work_entries}개`, 'dusi-summary-copy'));
    line.append(external(data!.source.catalog_url, '세종한글고전 전체 목록'));
    box.append(line);
    if (tocStatus.value !== 'all') box.append(el('p', `현재 범위: ${tocLabels[tocStatus.value as TocStatus]} 자료`, 'dusi-notice'));
  }
  const supplements = get('dusi-supplements');
  supplements.replaceChildren();
  if (volume) {
    const extras = data!.entries.filter(e => e.book_code === volume.book_code && (e.kind === 'supplement' || e.kind === 'category'));
    if (extras.length) {
      const details = el('details');
      details.append(el('summary', '분류 원문·참고문헌 링크'));
      const list = el('ul');
      for (const extra of extras) { const li = el('li'); li.append(external(extra.url, extra.title_raw)); list.append(li); }
      details.append(list);
      supplements.append(details);
    }
  }
}
function renderResults(): void {
  if (!data) return;
  const scoped = scopedWorks();
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = scoped.filter(e => {
    const text = `${e.title_raw} ${e.category_path.join(' ')} ${data!.volumes.find(v => v.book_code === e.book_code)!.title_raw}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term)) && (category.value === 'all' || e.category_path.includes(category.value))
      && (evidence.value === 'all' || e.verification === evidence.value);
  });
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  page = Math.min(page, pages);
  get('dusi-result-count').textContent = `표시 ${matches.length}개 / 현재 범위 ${scoped.length}개 작품 항목`;
  results.replaceChildren();
  if (!matches.length) {
    const box = el('div', '', 'dusi-empty');
    const volume = currentVolume();
    if (scoped.length === 0 && (volume?.toc_status !== 'direct_toc_observed')) {
      box.append(el('strong', '확인된 작품 링크가 아직 없습니다.'), el('p', '목차를 아직 확인하지 못했거나 선택한 분류의 작품 링크가 수집되지 않았습니다. 작품이 없다는 뜻은 아닙니다.'));
      box.append(external(volume?.toc_url ?? data.source.catalog_url, volume ? '공식 권별 목차 보기' : '공식 자료 목록 보기'));
    } else {
      box.append(el('strong', '검색 조건에 맞는 수록 항목이 없습니다.'), el('p', '검색어·분류·확인 근거를 바꾸거나 검색·필터 초기화를 눌러 주세요. 미수집 작품의 존재 여부는 확인되지 않았습니다.'));
    }
    results.append(box);
  }
  let groupKey = '';
  let list: HTMLUListElement | undefined;
  for (const entry of matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
    const volume = data.volumes.find(v => v.book_code === entry.book_code)!;
    const group = `${shortTitle(volume)} · ${entry.category_path.join(' / ') || '분류 미확인'}`;
    if (group !== groupKey) {
      groupKey = group;
      const section = el('section', '', 'dusi-group');
      section.append(el('h3', group));
      list = el('ul', '', 'dusi-work-list');
      section.append(list);
      results.append(section);
    }
    const item = el('li', '', 'dusi-work');
    item.append(external(entry.url, entry.title_raw));
    const meta = el('div', '', 'dusi-work-meta');
    meta.append(statusTag(entry.verification === 'direct_toc_observed' ? '링크 · 목차에서 확인' : '링크 · 검색 자료에서 확인', entry.verification === 'direct_toc_observed' ? 'direct' : 'search'));
    meta.append(entry.body_status === 'header_only_body_blank'
      ? statusTag(bodyLabels[entry.body_status], 'blank')
      : el('span', bodyLabels[entry.body_status] ?? '본문 미확인', 'dusi-body-label'));
    item.append(meta);
    list!.append(item);
  }
  get('dusi-page').textContent = `${page} / ${pages} 페이지`;
  get<HTMLButtonElement>('dusi-prev').disabled = page === 1;
  get<HTMLButtonElement>('dusi-next').disabled = page === pages;
  document.querySelector<HTMLElement>('.dusi-pagination')!.hidden = matches.length === 0;
}
function selectBook(code: string): void {
  selectedBook = code;
  page = 1;
  category.value = 'all';
  renderVolumes(); renderCategories(); renderSummary(); renderResults();
  // Restore the sidebar focus after rebuilding buttons; native mobile select keeps its node.
  if (window.matchMedia('(max-width: 700px)').matches) {
    get('dusi-volume-summary').scrollIntoView({ block: 'start' });
  } else {
    get('dusi-volume-list').querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    document.querySelector('.dusi-main')!.scrollTop = 0;
  }
}
async function load(): Promise<void> {
  if (loadingData || data) return;
  loadingData = true;
  loading.hidden = false; retry.hidden = true;
  loading.textContent = '자료를 불러오는 중입니다…';
  try {
    const response = await fetch('./data/sejong-dusi/metadata.json');
    if (!response.ok) throw new Error(`Metadata: ${response.status}`);
    const loaded: Catalog = await response.json();
    if (loaded.schema_version !== '1.0.0' || !Array.isArray(loaded.volumes) || !Array.isArray(loaded.entries)) throw new Error('Unexpected metadata format');
    data = loaded;
    renderVolumes(); renderCategories(); renderSummary(); renderResults();
    get('dusi-source-date').textContent = `${loaded.observed_date} 조사 · 세종대왕기념사업회 「세종한글고전」`;
    browser.hidden = false; loading.hidden = true;
  } catch (error) {
    data = null;
    browser.hidden = true;
    loading.textContent = '자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 불러오기를 눌러 주세요.';
    retry.hidden = false;
    console.error('Dusi metadata loading failed:', error);
  } finally { loadingData = false; }
}
function open(): void { if (!dialog.open) dialog.showModal(); void load(); }
function close(): void {
  dialog.close();
  if (location.hash === '#dusi') history.replaceState(null, '', location.pathname + location.search);
  opener.focus({ preventScroll: true });
}
opener.addEventListener('click', open);
get('close-dusi').addEventListener('click', close);
dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
retry.addEventListener('click', () => void load());
tocStatus.addEventListener('change', () => {
  if (!visibleVolumes().some(v => v.book_code === selectedBook)) selectedBook = 'all';
  page = 1;
  renderVolumes(); renderCategories(); renderSummary(); renderResults();
});
volumeSelect.addEventListener('change', () => selectBook(volumeSelect.value));
for (const input of [query, category, evidence]) input.addEventListener(input === query ? 'input' : 'change', () => { page = 1; renderResults(); });
get('dusi-reset').addEventListener('click', () => {
  query.value = ''; category.value = 'all'; evidence.value = 'all'; tocStatus.value = 'all'; page = 1;
  renderVolumes(); renderCategories(); renderSummary(); renderResults();
});
for (const [id, step] of [['dusi-prev', -1], ['dusi-next', 1]] as const) get(id).addEventListener('click', () => {
  page += step; renderResults();
  get('dusi-result-count').scrollIntoView({ block: 'start' });
  results.tabIndex = -1; results.focus({ preventScroll: true });
});
window.addEventListener('hashchange', () => { if (location.hash === '#dusi') open(); });
if (location.hash === '#dusi') open();
