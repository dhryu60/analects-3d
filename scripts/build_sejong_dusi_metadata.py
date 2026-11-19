"""Build an offline link catalog from the preserved 2026-11-19 observations.

Run: python -X utf8 scripts/build_sejong_dusi_metadata.py
No network access, inferred source URLs, or source-text normalization.
"""
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse

PROJECT = Path(__file__).resolve().parents[1]
SOURCES = PROJECT / "data-sources" / "sejong-dusi"
OUT = PROJECT / "public" / "data" / "sejong-dusi"
DATE = "2026-11-19"


def read_json(name):
    return json.loads((SOURCES / name).read_text(encoding="utf-8-sig"))


def params(url):
    parsed = urlparse(url)
    assert parsed.scheme == "https" and parsed.netloc == "db.sejongkorea.org", url
    return {k: v[0] for k, v in parse_qs(parsed.query).items()}


def node_id(book, record):
    return f"sejong:{book}:{record}"


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


raw = read_json(f"observed-{DATE}.json")
search = read_json(f"search-evidence-{DATE}.json")
toc_by_book = {params(v["url"])["bkCode"]: v for v in raw["tocs"]}
category_observations = {v["book_code"]: v for v in search["category_observations"]}
statuses = {
    "direct_toc_observed": "목차 직접 확인",
    "search_index_observed": "공식 검색 자료 확인",
    "partial_search_only": "검색 자료 일부 확인·목차 미확인",
    "unverified": "미확인",
    "not_inspected": "본문 미확인",
    "header_only_body_blank": "상세 제목 확인·본문 공백",
    "search_excerpt_seen": "본문 검색 발췌만 확인",
    "not_listed": "현재 자료군 목록에 없음",
}
volumes = []
entries = []
evidence = [{
    "id": "catalog", "method": "browser_dom", "url": raw["source"],
    "observed_date": DATE, "scope": "자료군 화면에 등재된 제목과 권별 목차 주소 29개",
}]

for position, volume in enumerate(raw["volumes"], 1):
    book = params(volume["url"])["bkCode"]
    match = re.search(r"권(\d+)(?:\(([^)]+)\))?$", volume["title"])
    assert match, volume["title"]
    number, qualifier = int(match[1]), match[2]
    toc = toc_by_book.get(book)
    cat_observed = category_observations.get(book)
    volume_row = {
        "id": f"sejong:{book}", "book_code": book, "catalog_order": position,
        "title_raw": volume["title"], "volume_number": number,
        "part": qualifier if qualifier in ("상", "하") else None,
        "edition_label": qualifier if qualifier in ("초간본", "중간본") else None,
        "edition_note": "제목에 명시된 판본만 기록. null은 판본 미상이며 초간본을 뜻하지 않는다.",
        "toc_url": volume["url"], "catalog_status": "listed_directly",
        "catalog_evidence_id": "catalog", "observed_date": DATE,
        "toc_status": "direct_toc_observed" if toc else "partial_search_only" if cat_observed else "unverified",
        "observed_categories": [], "imported_toc_node_count": len(toc["entries"]) if toc else None,
        "imported_work_entry_count": None, "known_search_work_link_count": 0,
        "complete_poem_count": None,
        "access_note": None,
    }
    if book in ("P51_BD_v017", "P51_BD_v018", "P51_BD_v019_1"):
        volume_row["access_note"] = "이전 직접 목차 열람 시 연결 종료 오류. 자료 부재로 판정하지 않음."
    elif not toc:
        volume_row["access_note"] = "직접 목차 확인을 완료하지 못함. 검색 발췌 유무와 구분."
    if cat_observed:
        volume_row["observed_categories"] = [{
            "title_raw": label, "verification": "search_index_observed",
            "evidence_url": cat_observed["source_url"],
        } for label in cat_observed["labels"]]
    if toc:
        evid = f"toc:{book}"
        evidence.append({"id": evid, "method": "browser_dom", "url": toc["url"],
                         "observed_date": DATE,
                         "scope": "목록 영역에 있는 상세 링크의 제목·URL·중첩 깊이. 대상 본문 전체를 열람한 것은 아님."})
        stack = {}
        work_count = 0
        for order, item in enumerate(toc["entries"], 1):
            p = params(item["url"])
            assert p["bkCode"] == book
            depth = item["depth"]
            kind = {1: "collection", 2: "volume", 3: "category", 4: "work"}[depth]
            if depth == 3 and ("참고문헌" in item["title"] or item["title"] == "자료문헌 약호"):
                kind = "supplement"
            parent = stack.get(depth - 1)
            assert depth == 1 or parent is not None
            category = ([stack[3]["title_raw"]] if depth == 4 and stack[3]["kind"] == "category" else [])
            if kind == "category":
                category = [item["title"]]
            row = {
                "id": node_id(book, p["recordId"]), "book_code": book,
                "record_id": p["recordId"], "kind": kind, "title_raw": item["title"],
                "url": item["url"], "parent_id": parent["id"] if parent else None,
                "category_path": category, "toc_order": order, "toc_depth": depth,
                "hierarchy_basis": "observed_dom_depth",
                "verification": "direct_toc_observed", "evidence_id": evid,
                "observed_date": DATE,
                "body_status": "header_only_body_blank" if p["recordId"] == "P51_BD_e01_v002_1_0020" else "not_inspected",
                "live_link_status": "header_only_observed" if p["recordId"] == "P51_BD_e01_v002_1_0020" else "not_tested",
                "poem_count": None, "author_name": None, "archive_relations": [],
                "has_private_use_characters": any(0xE000 <= ord(c) <= 0xF8FF for c in item["title"]),
            }
            entries.append(row)
            stack = {d: r for d, r in stack.items() if d < depth}
            stack[depth] = row
            if kind == "category":
                volume_row["observed_categories"].append({"title_raw": item["title"],
                    "verification": "direct_toc_observed", "evidence_url": toc["url"], "entry_id": row["id"]})
            work_count += kind == "work"
        volume_row["imported_work_entry_count"] = work_count
    volumes.append(volume_row)

for item in search["linked_entries"]:
    book, record = item["book_code"], item["record_id"]
    assert params(item["url"]) == {"bkCode": book, "recordId": record}
    evid = f"search:{book}:{record}"
    evidence.append({"id": evid, "method": "official_site_search_index", "url": item["url"],
        "observed_date": DATE, "scope": "공식 사이트의 검색 수록 발췌. 직접 열람과 구분."})
    entries.append({
        "id": node_id(book, record), "book_code": book, "record_id": record,
        "kind": item["kind"], "title_raw": item["title_raw"], "url": item["url"],
        "parent_id": node_id(book, item["parent_record_id"]) if item["parent_record_id"] else None,
        "category_path": item["category_path"], "toc_order": None, "toc_depth": None,
        "hierarchy_basis": "search_breadcrumb_or_list", "verification": "search_index_observed",
        "evidence_id": evid, "observed_date": DATE,
        "body_status": "search_excerpt_seen" if item["kind"] == "work" else "not_inspected",
        "live_link_status": "not_verified", "poem_count": None, "author_name": None,
        "archive_relations": [],
        "has_private_use_characters": any(0xE000 <= ord(c) <= 0xF8FF for c in item["title_raw"]),
    })

for volume in volumes:
    volume["known_search_work_link_count"] = sum(
        e["book_code"] == volume["book_code"] and e["kind"] == "work" and e["verification"] == "search_index_observed"
        for e in entries)

listed_numbers = sorted({v["volume_number"] for v in volumes})
counts = {
    "listed_volume_numbers": len(listed_numbers), "listed_book_units": len(volumes),
    "directly_observed_tocs": len(toc_by_book),
    "partial_search_only_tocs": sum(v["toc_status"] == "partial_search_only" for v in volumes),
    "unverified_tocs": sum(v["toc_status"] == "unverified" for v in volumes),
    "direct_toc_nodes": sum(len(v["entries"]) for v in raw["tocs"]),
    "direct_toc_work_entries": sum(e["kind"] == "work" and e["verification"] == "direct_toc_observed" for e in entries),
    "search_only_linked_nodes": len(search["linked_entries"]),
    "search_only_work_entries": sum(e["kind"] == "work" and e["verification"] == "search_index_observed" for e in entries),
    "total_linked_nodes": len(entries), "total_linked_work_entries": sum(e["kind"] == "work" for e in entries),
}
catalog = {
    "schema_version": "1.0.0", "dataset_id": "doklakdang:external:sejong:P51_BD",
    "title": "독락당 디지털 아카이브 — 분류두공부시언해 외부자료 연결 메타데이터",
    "observed_date": DATE, "timezone": "Asia/Seoul", "status": "partial_observation",
    "source": {"provider": "세종대왕기념사업회", "service": "세종한글고전", "collection_code": "P51_BD",
               "collection_title": "역주 분류두공부시언해", "catalog_url": raw["source"]},
    "counts": counts, "status_labels": statuses,
    "interpretation_rules": [
        "작품 항목 수는 시의 수 또는 중복 제거된 작품 수가 아니다. 여러 수를 묶은 항목과 판본별 중복이 포함된다.",
        "목차 확인은 제목과 주소를 보았다는 뜻이다. 본문 제공·현행 접속 성공을 보증하지 않는다.",
        "검색 자료는 공식 도메인의 검색 수록 발췌이다. 실시간 직접 확인으로 격상하지 않는다.",
        "null은 미확인·미수집이다. 0 또는 부재로 해석하지 않는다.",
        "제목의 한글·한자·옛한글·오탈자 가능성을 원형 그대로 보존했다. 대괄호를 한문 제목으로 일괄 분리하지 않았다.",
        "상·하와 판본은 제목을 근거로 별도 필드에 기록했다. _1과 _2 접미사만으로 의미를 판단하지 않는다.",
        "개별 작자와 독락당 관련성은 검증 전이므로 비워 두었다. 자료군의 대표 작자를 모든 작품에 대입하지 않는다.",
        "검색 자료의 parent_id가 null인 작품은 상위 항목 식별자가 미확인인 경우다. category_path는 관찰된 분류명이다.",
        "목차 링크의 유형은 관찰된 중첩 깊이와 부속자료 제목으로 분류했다. 본문 대조를 통한 장르 판정은 아니다.",
    ],
    "volume_number_coverage": [{"volume_number": n, "catalog_status": "listed" if n in listed_numbers else "not_listed",
        "book_codes": [v["book_code"] for v in volumes if v["volume_number"] == n],
        "note": None if n in listed_numbers else "조사 당시 이 자료군 목록에 없음. 원전 결락이나 다른 서비스의 제공 여부는 미판정."} for n in range(1, 26)],
    "volumes": volumes, "entries": entries, "evidence": evidence,
    "content_structure": {
        "verification": "search_index_observed", "scope": "공식 범례와 일부 작품의 검색 발췌에서 확인. 모든 작품에 대한 확인 아님.",
        "layers": ["한문 원문", "언해 원문", "현대어 풀이", "주해"],
        "optional_elements_observed": ["한자음", "원전 장차 및 ㄱ·ㄴ 표기", "판본 차이 설명"],
        "evidence": search["structure_evidence"],
        "not_verified": ["본문 표시 전환 작동", "영인 이미지 제공 범위", "전체 작품 본문 완결성", "API 및 일괄 다운로드 제공 여부"],
    },
    "pending_checks": {
        "toc_book_codes": [v["book_code"] for v in volumes if v["toc_status"] != "direct_toc_observed"],
        "all_work_bodies_need_direct_verification": True,
        "body_blank_entry_ids": [e["id"] for e in entries if e["body_status"] == "header_only_body_blank"],
        "search_only_entry_ids": [e["id"] for e in entries if e["verification"] == "search_index_observed"],
        "archive_relation_review": "독락당 소장·인용·인물 관련성은 별도 근거를 확보한 뒤 archive_relations에 기록",
    },
    "provenance_files": [{"path": f"data-sources/sejong-dusi/{p.name}", "sha256": sha256(p.read_bytes()).hexdigest()}
                         for p in sorted(SOURCES.glob("*.json"))],
}

# Integrity checks cover source preservation, relationships, status separation, and URL identities.
ids = [e["id"] for e in entries]
assert len(ids) == len(set(ids))
assert len({e["url"] for e in entries}) == len(entries)
by_id = {e["id"]: e for e in entries}
book_codes = {v["book_code"] for v in volumes}
evidence_ids = {e["id"] for e in evidence}
for entry in entries:
    assert entry["book_code"] in book_codes
    assert entry["evidence_id"] in evidence_ids
    assert params(entry["url"]) == {"bkCode": entry["book_code"], "recordId": entry["record_id"]}
    if entry["parent_id"]:
        assert entry["parent_id"] in by_id
        assert by_id[entry["parent_id"]]["book_code"] == entry["book_code"]
    if entry["verification"] == "direct_toc_observed":
        assert entry["body_status"] != "search_excerpt_seen"
for volume in raw["tocs"]:
    book = params(volume["url"])["bkCode"]
    for original in volume["entries"]:
        found = by_id[node_id(book, params(original["url"])["recordId"])]
        assert (found["title_raw"], found["url"], found["toc_depth"]) == (original["title"], original["url"], original["depth"])
assert counts == {"listed_volume_numbers": 19, "listed_book_units": 29,
    "directly_observed_tocs": 16, "partial_search_only_tocs": 2, "unverified_tocs": 11,
    "direct_toc_nodes": 698, "direct_toc_work_entries": 612,
    "search_only_linked_nodes": 12, "search_only_work_entries": 7,
    "total_linked_nodes": 710, "total_linked_work_entries": 619}

OUT.mkdir(parents=True, exist_ok=True)
write_json("metadata.json", catalog)

def h(value):
    return escape(str(value), quote=True)


def link(url, label):
    return f'<a href="{h(url)}" target="_blank" rel="noopener noreferrer">{h(label)}</a>'


def badge(status):
    color = "green" if status == "direct_toc_observed" else "amber" if status in ("partial_search_only", "search_index_observed") else "gray"
    return f'<span class="badge {color}">{h(statuses.get(status, status))}</span>'


rows, sections = [], []
kind_labels = {"collection": "자료군", "volume": "권차", "category": "분류", "supplement": "부속자료", "work": "작품"}
for v in volumes:
    cats = " · ".join(c["title_raw"] for c in v["observed_categories"]) or "미확인"
    title = v["title_raw"].replace("역주 분류두공부시언해 ", "")
    work_count = v["imported_work_entry_count"]
    imported = str(work_count) if work_count is not None else "미확인"
    if v["known_search_work_link_count"]:
        imported += f' (검색 링크 {v["known_search_work_link_count"]}개)'
    rows.append(f'<tr><th><a href="#{h(v["book_code"])}">{h(title)}</a></th><td>{badge(v["toc_status"])}</td><td>{h(cats)}</td><td>{h(imported)}</td><td>{link(v["toc_url"], "공식 목차")}</td></tr>')
    data_rows = []
    for entry in (e for e in entries if e["book_code"] == v["book_code"]):
        data_rows.append(f'<tr><td>{h(kind_labels[entry["kind"]])}</td><td>{h(" / ".join(entry["category_path"]))}</td><td>{link(entry["url"], entry["title_raw"])}<small>{h(entry["record_id"])}</small></td><td>{badge(entry["verification"])}</td><td>{h(statuses[entry["body_status"]])}</td></tr>')
    content = ('<div class="scroll"><table><thead><tr><th>유형</th><th>분류</th><th>제목·원자료 링크</th><th>확인 근거</th><th>본문 상태</th></tr></thead><tbody>' + "".join(data_rows) + '</tbody></table></div>') if data_rows else '<p>작품 목록과 주소를 아직 확인하지 못했습니다. 작품이 없다는 뜻은 아닙니다.</p>'
    sections.append(f'<details id="{h(v["book_code"])}"><summary>{h(title)} — {h(statuses[v["toc_status"]])}</summary><p>{h(cats)} · {link(v["toc_url"], "공식 목차 열기")}</p><p class="muted">{h(v["access_note"] or "목차에서 확인한 주소입니다. 작품별 본문 상태는 아래 열을 확인하세요.")}</p>{content}</details>')

html = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>독락당 · 두시언해 연결 메타데이터</title><style>
:root{font-family:"Malgun Gothic","Noto Sans KR",sans-serif;color:#243332;background:#f5f3ee;line-height:1.65}body{margin:0}main{max-width:1320px;margin:auto;padding:40px 28px 80px}h1{font-size:clamp(26px,4vw,36px);letter-spacing:-1px;margin:8px 0 18px}h2{font-size:23px;margin-top:40px}a{color:#175c64;text-underline-offset:3px}header{border-bottom:2px solid #244f47;padding-bottom:24px}.eyebrow{letter-spacing:2px;color:#476c62;font-size:13px}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.stat{background:white;padding:16px 24px;border:1px solid #dddacf;border-radius:8px}.stat b{font-size:27px;display:block}p{max-width:1000px}.muted,small{color:#60706a;font-size:13px}.note{background:#fff4dc;border-left:4px solid #b98024;padding:16px 20px}table{border-collapse:collapse;width:100%;background:white;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #e2e6e1;vertical-align:top}thead th{background:#e6eee9;white-space:nowrap}tbody th{min-width:95px}td small{display:block;font-size:11px;overflow-wrap:anywhere}.scroll{overflow-x:auto}details{margin:14px 0;border:1px solid #d9dfd8;border-radius:6px;background:white;padding:16px;scroll-margin-top:20px}summary{cursor:pointer;font-weight:bold}.badge{display:inline-block;font-size:12px;border-radius:4px;padding:3px 7px;white-space:nowrap}.green{background:#dceee1;color:#215837}.amber{background:#ffedc9;color:#76551b}.gray{background:#e8e9e8;color:#515957}code{overflow-wrap:anywhere}footer{margin-top:40px;border-top:1px solid #d9dfd8;padding-top:20px}@media(max-width:600px){main{padding:22px 14px}th,td{padding:9px}.stat{padding:12px 16px}}@media print{details{break-inside:avoid}a{color:inherit}}
</style></head><body><main><header><div class="eyebrow">獨樂堂 · 외부자료 연결 목록</div><h1>분류두공부시언해 메타데이터</h1><p>2026년 11월 19일 조사 · 세종대왕기념사업회 「세종한글고전」</p><p>권차·분류·작품별 링크와 확인 근거를 정리했습니다. 제목을 누르면 공식 사이트로 이동합니다.</p><p><a href="metadata.json">연결용 JSON</a> · <a href="README.txt">필드와 상태 설명</a> · <a href="validation.json">검증 결과</a></p></header>
<div class="stats"><div class="stat"><b>29</b>등록 자료 · 19개 권차</div><div class="stat"><b>16</b>목차 직접 확인</div><div class="stat"><b>612 + 7</b>직접 목차 / 검색 작품 링크</div><div class="stat"><b>13</b>전체 목차 확인 필요</div></div>
<p class="note"><strong>목차 확인과 본문 확인은 다릅니다.</strong> 작품 링크 619개는 판본별·묶음 작품 항목을 센 수이며, 시의 총수나 중복 제거 작품 수가 아닙니다. 검색 자료는 일부 발췌만 확인했습니다. 상세 페이지를 직접 열어 본 「촉을 떠나며」는 본문이 비어 있었고, 나머지 작품도 본문 전체를 직접 검증하지 않았습니다.</p>
<h2>권별 확인 현황</h2><p>초록: 목차 직접 확인 / 노랑: 공식 검색 자료 일부 확인 / 회색: 미확인. 권1·4·6·7·9·13은 현재 자료군 목록에 없습니다. 원전 결락 여부를 뜻하지 않습니다.</p>
<div class="scroll"><table><thead><tr><th>권차</th><th>목차 상태</th><th>확인한 분류</th><th>작품 항목</th><th>출처</th></tr></thead><tbody>''' + "".join(rows) + '''</tbody></table></div><h2>목차와 작품 링크</h2><p>각 권을 펼치면 보존한 목차 항목을 볼 수 있습니다. 검색으로 보완한 항목은 따로 표시했습니다. 미확인 항목의 주소나 작품 목록을 추정해 채우지 않았습니다.</p>''' + "".join(sections) + '''<h2>연결 시 적용할 기준</h2><ul><li>자료 식별자는 book_code, 상세 항목은 book_code와 record_id를 함께 사용합니다.</li><li>상·하 구분과 초간본·중간본 구분은 별도 필드입니다. 판본이 명시되지 않은 자료는 null로 남겼습니다.</li><li>옛한글을 포함한 제목은 원형 그대로 저장했습니다. 제목에 저자 표기가 섞일 수 있어 대괄호 내용을 한문 제목으로 자동 분리하지 않았습니다.</li><li>작품별 작자와 독락당 관련성은 아직 확인하지 않았습니다.</li></ul><footer><p>본문 구성은 공식 범례와 검색 발췌에서 한문 원문·언해 원문·현대어 풀이·주해로 확인했습니다. 영인 이미지, 전체 본문, 표시 전환 및 API 제공 여부는 미확인입니다.</p><p>''' + link(raw["source"], "세종한글고전 자료군 목록") + '''</p></footer></main><script>function openTarget(){const id=decodeURIComponent(location.hash.slice(1));const el=document.getElementById(id);if(el&&el.tagName==='DETAILS')el.open=true}window.addEventListener('hashchange',openTarget);openTarget();</script></body></html>'''
(OUT / "catalog.html").write_text(html, encoding="utf-8")

guide = f'''독락당 디지털 아카이브 — 두시언해 연결 메타데이터
조사일: {DATE} (Asia/Seoul)
데이터 버전: 1.0.0 / 부분 조사 자료

파일
- metadata.json: 연결용 전체 메타데이터. UTF-8. 본문 복제 없이 제목·출처·식별자·검증 상태를 제공.
- catalog.html: 사람이 검토할 수 있는 권별 현황과 링크 목록. 로컬에서 바로 열 수 있음.
- validation.json: 무결성 검사 결과. 웹 링크의 실시간 접속 검사가 아님.

범위
29개 자료(19개 권차), 직접 확인 목차 16개, 직접 목차 항목 698개(작품 612개).
공식 검색 자료 보완 링크 12개(작품 7개). 합계 710개 링크 항목, 작품 링크 619개.
나머지 13개 자료는 목차 미완료: 그중 2개는 검색에서 분류와 일부 링크만 확인, 11개는 목차 미확인.
권12의 초간본·중간본을 합치지 않았으며, 여러 수를 묶은 항목을 개별 시로 분할하지 않았다.

최상위 필드
source: 출처 기관·서비스·자료군 코드·목록 URL.
counts: 수집 범위의 실제 건수. 전체 원전 규모로 해석 금지.
volume_number_coverage: 원전 권1~25의 현재 목록 등재 상태. 미등재는 결락이나 다른 곳의 미제공을 뜻하지 않음.
volumes: 29개 자료의 권차·분책·판본 및 목차 확인 상태.
entries: 자료군·권차·분류·부속자료·작품의 링크 노드 710개.
evidence: 확인 근거의 URL·방법·범위·날짜.
content_structure: 범례와 일부 검색 발췌에서 확인한 제공 구조. 개별 작품 전체 제공 판정이 아님.
pending_checks: 목차 확인이 남은 자료, 본문 공백 및 검색 보완 항목 등.
provenance_files: 프로젝트 내 관찰 원자료와 SHA-256.

volumes 주요 필드
id / book_code: 자료 단위의 식별자. 예 sejong:P51_BD_v012_1 / P51_BD_v012_1.
volume_number: 원전 권 번호. part: 제목에 나타난 상 또는 하. edition_label: 초간본 또는 중간본.
edition_label=null: 제목으로 판본을 확정하지 못함. 상·하 구분과 별개.
toc_url: 목록에서 관찰한 권별 목차 URL.
toc_status: direct_toc_observed / partial_search_only / unverified.
observed_categories: 확인된 분류명과 그 근거. 검색 분류는 전체 목차를 뜻하지 않음.
imported_toc_node_count / imported_work_entry_count: 직접 확인 목차에서 가져온 건수. 미확인은 null.
known_search_work_link_count: 검색 발췌에서 확인한 작품 링크 수.

entries 주요 필드
id: sejong:book_code:record_id. record_id만으로 합치면 권별 자료군 루트가 충돌할 수 있음.
kind: collection / volume / category / supplement / work.
title_raw: 관찰 당시 제목 그대로. 옛한글·PUA를 유지. 제목이 같아도 다른 id는 유지.
url: 직접 목차 또는 공식 검색 결과에서 관찰한 상세 주소. 미확인 URL을 생성하지 않음.
parent_id: 같은 자료 내 상위 노드. 검색 발췌에서 상위 주소가 불명확하면 null.
category_path: 관찰된 분류명 배열. parent_id가 null이어도 검색 경로의 분류명은 있을 수 있음.
toc_order / toc_depth: 직접 관찰 목차의 순서와 깊이. 검색 보완 항목은 null.
hierarchy_basis: observed_dom_depth 또는 search_breadcrumb_or_list.
verification: direct_toc_observed(목차 직접 확인) 또는 search_index_observed(공식 검색 자료 확인).
evidence_id: evidence 배열의 근거 참조.
body_status: not_inspected(미확인), header_only_body_blank(상세 제목만 보이고 본문 공백), search_excerpt_seen(검색 발췌만 확인).
live_link_status: not_tested / header_only_observed / not_verified. 정상 접속 확인을 뜻하는 값 없음.
poem_count / author_name: 미확인으로 null. 모든 작품의 작자를 두보로 일괄 지정하지 않음.
archive_relations: 독락당의 인물·소장·인용 관계가 검증되면 추가할 배열. 현재 빈 배열.
has_private_use_characters: 제목에 U+E000~F8FF 문자가 있는지. 문자 교정을 뜻하지 않음.

적용 예
const response = await fetch('./data/sejong-dusi/metadata.json');
const data = await response.json();
const works = data.entries.filter(e => e.kind === 'work');
// 각 링크 옆에는 verification과 body_status를 별도로 표시한다.
// 외부 링크에는 rel="noopener noreferrer"를 적용한다.
// null을 0이나 '없음'으로 표시하지 않는다.

프로젝트 내 위치: public/data/sejong-dusi/
웹에 배포될 경우 상대 경로: ./data/sejong-dusi/metadata.json
아카이브 상단 '두시언해 자료 탐색' 또는 #dusi에서 이 메타데이터를 탐색한다.
목차·작품 검색과 상태 필터를 제공하며, 링크는 공식 사이트의 새 탭으로 열린다.

재생성
프로젝트 루트에서: python -X utf8 scripts/build_sejong_dusi_metadata.py
네트워크 요청 없이 data-sources/sejong-dusi/의 두 원자료로 재생성한다.
'''
(OUT / "README.txt").write_text(guide, encoding="utf-8")

# Verify the serialized artifact and catalog contain the observed records without loss.
reloaded = json.loads((OUT / "metadata.json").read_text(encoding="utf-8"))
assert reloaded == catalog
assert "\ufffd" not in (OUT / "metadata.json").read_text(encoding="utf-8")
assert all(h(e["url"]) in html and h(e["title_raw"]) in html for e in entries)
write_json("validation.json", {
    "observation_date": DATE, "result": "passed", "counts": counts,
    "checks": ["JSON serialization round trip", "Unique composite entry identifiers and URLs",
        "All URLs match observed book_code and record_id", "All parent references resolve within the same book",
        "All direct TOC titles, URLs and depths preserved exactly", "All entry evidence references resolve",
        "Expected observation coverage counts", "All entry titles and URLs appear in the HTML catalog",
        "No replacement characters introduced"],
    "network_link_check_performed": False,
    "limitations": ["Live page reachability and full body content were not verified by these checks.",
                    "Work entry counts are not poem totals or deduplicated work counts."],
})
print(json.dumps({"output": str(OUT), "validation": "passed", "counts": counts}, ensure_ascii=False, indent=2))
