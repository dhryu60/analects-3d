독락당 디지털 아카이브 — 두시언해 연결 메타데이터
조사일: 2026-11-19 (Asia/Seoul)
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
