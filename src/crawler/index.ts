/**
 * 사람인 공고 크롤러 — HTTP GET 기반(헤드리스 브라우저 아님, 명세 준수).
 * 사람인은 iframe이 아니라 view-detail 엔드포인트로 본문을 직접 제공한다.
 *
 * 개발용 수집 도구다. 매칭 파이프라인 밖에 있으며, 저장된 fixture를 재수집할 때만 쓴다.
 */
import * as cheerio from "cheerio";

const BASE = "https://www.saramin.co.kr";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 공고 URL(어떤 형태든 rec_idx 포함)에서 공고 ID를 뽑는다. */
export function extractRecIdx(url: string): string {
  const m = url.match(/rec_idx=(\d+)/);
  if (!m) throw new Error(`URL에서 rec_idx를 찾을 수 없습니다: ${url}`);
  return m[1];
}

/** 공고 URL → 본문 HTML(view-detail). HTTP GET 한 번. */
export async function fetchJobPosting(url: string): Promise<string> {
  const recIdx = extractRecIdx(url);
  const detailUrl = `${BASE}/zf_user/jobs/relay/view-detail?rec_idx=${recIdx}&rec_seq=0`;
  const res = await fetch(detailUrl, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${detailUrl}`);
  return res.text();
}

/**
 * 공고 HTML → 본문 텍스트(.user_content). LLM 추출기의 입력.
 * 구조가 달라 본문 컨테이너를 못 찾으면 조용히 빈 값을 반환하지 않고 크게 실패한다(CLAUDE.md §9).
 */
export function extractBodyText(html: string): string {
  const $ = cheerio.load(html);
  const body = $(".user_content").first();
  if (body.length === 0) {
    throw new Error(
      "본문 컨테이너(.user_content)를 찾지 못했습니다 — 공고 구조 불일치. 빈 값 대신 실패로 처리.",
    );
  }
  return body.text().replace(/\s+/g, " ").trim();
}
