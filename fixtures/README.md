# fixtures — 공고 수집 대장

크롤링한 사람인 공고 원문(HTML)과 파생물을 보관한다.
**원문 HTML은 사람인 DB권 이슈로 커밋하지 않는다**(`.gitignore`). 이 대장(README)만 버전 관리한다.

| 경로 (fixtures/) | 회사 | 직군 | 원본 URL | 수집일 | 용도 |
|---|---|---|---|---|---|
| `postings/54259129-inflearn-frontend` | 인프런 | 프론트엔드(개발) | [view?rec_idx=54259129](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54259129) | 2026-07-17 | **메인** — 필수/우대 헤더 뚜렷 |
| `postings/54352607-naver-webtoon-disney-server` | 네이버웹툰 | 서버(개발) | [view?rec_idx=54352607](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54352607) | 2026-07-17 | 예비 (셀렉터 baseline) |
| `postings/54158776-miricanvas-fe-web-editor` | 미리캔버스 | 프론트엔드(개발) | [view?rec_idx=54158776](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54158776) | 2026-07-17 | 예비 |
| `postings/54158783-miricanvas-fe-product` | 미리캔버스 | 프론트엔드(개발) | [view?rec_idx=54158783](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54158783) | 2026-07-17 | 예비 |
| `postings/54001953-zuzu-software-engineer` | ZUZU | 개발 | [view?rec_idx=54001953](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54001953) | 2026-07-17 | **폐기 — 본문 일부 유실(사례 기록용, 삭제 금지)** |
| `holdout/54448155-lineandcompany-perf-marketer` | 라인앤컴퍼니 | 퍼포먼스 마케터(비개발) | [view?rec_idx=54448155](https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54448155) | 2026-07-18 | **홀드아웃 — 2026-07-18 20:00까지 봉인** |

> **ZUZU(54001953)**: 동일 크롤러로 수집했으나 본문 일부가 유실됐다. 사람인 공고가 단일 구조가 아님을 보여주는 사례라 **삭제하지 않고 남긴다**(README 재료). 범용 크롤러는 스코프에서 제외하고 대상 공고의 정확성을 택한 근거.

## 재수집 명령어

```bash
# 단일 공고 (URL → fixtures/postings/{slug}/)
pnpm tsx scripts/fetch-fixture.ts "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=<ID>" <slug>

# 홀드아웃 후보 탐색 (검색어로 후보 N개 + 구조지표만 출력, 본문 미노출)
pnpm tsx scripts/holdout-collect.ts "<검색어>" <개수>
```
