/**
 * 홀드아웃 후보 수집 — 오염 방지 스크립트.
 *
 * ⚠️ 오염 방지 계약 (이 스크립트의 존재 이유):
 *   - stdout에는 [회사/제목/URL] 목록과 "구조 지표"만 출력한다.
 *   - 공고 "본문 텍스트 · 요건 문장"은 절대 stdout에 내지 않는다(파일로만 저장).
 *   - 사람도 LLM도 본문 의미를 보지 않고 "구조"로만 홀드아웃을 고르기 위함.
 *     (일반화는 본 적 없는 입력에서만 증명된다 — CLAUDE.md §6)
 *
 * 단계:
 *   1) 사람인 검색 → 후보 리스트 [회사 / 제목 / rec_idx]        (허용: 목록 메타)
 *   2) 각 후보의 view-detail(+view-ajax) HTML을
 *      fixtures/holdout_candidates/{rec_idx}/ 에 저장            (stdout 없음)
 *   3) 저장한 view-detail HTML의 "구조 지표"만 표로 출력         (본문 미노출)
 *
 * 실행: npx tsx scripts/holdout-collect.ts "퍼포먼스 마케터" 7
 */
import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://www.saramin.co.kr";
const OUT = join(process.cwd(), "fixtures", "holdout_candidates");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9",
      Accept: "text/html,application/xhtml+xml",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
}

interface Candidate {
  rec_idx: string;
  company: string;
  title: string;
}

/** 1) 검색 결과 파싱 — 목록 메타만(회사/제목/rec_idx). 본문 아님. */
async function search(keyword: string, limit: number): Promise<Candidate[]> {
  const url = `${BASE}/zf_user/search?searchType=search&searchword=${encodeURIComponent(keyword)}`;
  const $ = cheerio.load(await fetchText(url));
  const seen = new Set<string>();
  const out: Candidate[] = [];
  $(".item_recruit").each((_, el) => {
    if (out.length >= limit) return;
    const $el = $(el);
    const a = $el.find(".job_tit a").first();
    const href = a.attr("href") ?? "";
    const m = href.match(/rec_idx=(\d+)/);
    if (!m) return;
    const rec_idx = m[1];
    if (seen.has(rec_idx)) return;
    seen.add(rec_idx);
    out.push({
      rec_idx,
      company: (
        $el.find(".corp_name a").first().text() ||
        $el.find(".corp_name").first().text()
      ).trim(),
      title: (a.attr("title") || a.text()).trim(),
    });
  });
  return out;
}

/** 2) 후보 HTML 저장 — 파일로만. 반환값에 본문 안 담음. */
async function saveCandidate(c: Candidate): Promise<string> {
  const dir = join(OUT, c.rec_idx);
  mkdirSync(dir, { recursive: true });
  const viewUrl = `${BASE}/zf_user/jobs/relay/view?rec_idx=${c.rec_idx}`;
  const detail = await fetchText(
    `${BASE}/zf_user/jobs/relay/view-detail?rec_idx=${c.rec_idx}&rec_seq=0`,
    viewUrl,
  );
  writeFileSync(join(dir, "view-detail.html"), detail);
  await sleep(600);
  try {
    const ajax = await fetchText(
      `${BASE}/zf_user/jobs/relay/view-ajax?rec_idx=${c.rec_idx}`,
      viewUrl,
    );
    writeFileSync(join(dir, "view-ajax.html"), ajax);
  } catch {
    /* view-ajax는 선택적 */
  }
  writeFileSync(
    join(dir, "meta.json"),
    JSON.stringify(
      {
        rec_idx: c.rec_idx,
        company: c.company,
        title: c.title,
        url: viewUrl,
        fetchedAt: new Date().toISOString().slice(0, 10),
        sources: {
          body: `/zf_user/jobs/relay/view-detail?rec_idx=${c.rec_idx}&rec_seq=0`,
          meta: `/zf_user/jobs/relay/view-ajax?rec_idx=${c.rec_idx}`,
        },
      },
      null,
      2,
    ) + "\n",
  );
  return join(dir, "view-detail.html");
}

interface Metrics {
  textLen: number;
  hasMust: boolean; // "필수"
  hasQual: boolean; // "자격요건"
  hasPref: boolean; // "우대"
  hasPrefTitle: boolean; // "우대사항"
  bullets: number;
  imgCount: number; // .user_content 내 이미지 수 — 이미지형 JD 판별용
  iframe: boolean;
  parseOk: boolean;
}

/** 3) 구조 지표만 계산 — 본문 텍스트는 length/boolean/개수로만 환원, 문자열 미반환. */
function metrics(html: string): Metrics {
  const $ = cheerio.load(html);
  const $body = $(".user_content").first();
  const found = $body.length > 0;
  const text = found ? $body.text().replace(/\s+/g, " ").trim() : "";
  const has = (kw: string) => text.includes(kw);
  return {
    textLen: text.length,
    hasMust: has("필수"),
    hasQual: has("자격요건"),
    hasPref: has("우대"),
    hasPrefTitle: has("우대사항"),
    bullets: found ? $body.find("li").length : 0,
    imgCount: found ? $body.find("img").length : $("img").length,
    iframe: $("iframe").length > 0,
    parseOk: found && text.length > 150,
  };
}

const yn = (b: boolean) => (b ? "✓" : "·");
const pad = (s: string | number, n: number) => String(s).padEnd(n);

async function main() {
  const keyword = process.argv[2] ?? "퍼포먼스 마케터";
  const limit = Number(process.argv[3] ?? 12);

  console.log(`\n검색: "${keyword}"  (상위 ${limit}개 수집)\n`);
  const cands = await search(keyword, limit);
  if (cands.length === 0)
    throw new Error(
      "후보 0개 — 검색 파싱 실패(셀렉터 확인 필요). 조용히 빈 값 금지.",
    );

  console.log("── 후보 리스트 [회사 / 제목 / rec_idx] ──");
  cands.forEach((c, i) =>
    console.log(`  [${i + 1}] ${c.rec_idx}  ${c.company}  —  ${c.title}`),
  );

  const rows: (Metrics & { rec_idx: string })[] = [];
  for (const c of cands) {
    try {
      const path = await saveCandidate(c);
      const html = (await import("node:fs")).readFileSync(path, "utf8");
      rows.push({ rec_idx: c.rec_idx, ...metrics(html) });
    } catch (e) {
      rows.push({
        rec_idx: c.rec_idx,
        textLen: 0,
        hasMust: false,
        hasQual: false,
        hasPref: false,
        hasPrefTitle: false,
        bullets: 0,
        imgCount: 0,
        iframe: false,
        parseOk: false,
      });
      console.error(
        `  ⚠ ${c.rec_idx} 수집 실패: ${e instanceof Error ? e.message : e}`,
      );
    }
    await sleep(800);
  }

  console.log("\n── 구조 지표 (본문 내용 미노출) ──");
  console.log(
    `  ${pad("rec_idx", 11)}${pad("본문chars", 10)}${pad("img", 5)}${pad("불릿", 6)}${pad("필수", 5)}${pad("자격요건", 9)}${pad("우대", 5)}${pad("우대사항", 9)}${pad("iframe", 7)}파싱`,
  );
  for (const r of rows) {
    console.log(
      `  ${pad(r.rec_idx, 11)}${pad(r.textLen, 10)}${pad(r.imgCount, 5)}${pad(r.bullets, 6)}${pad(yn(r.hasMust), 5)}${pad(yn(r.hasQual), 9)}${pad(yn(r.hasPref), 5)}${pad(yn(r.hasPrefTitle), 9)}${pad(yn(r.iframe), 7)}${r.parseOk ? "OK" : "FAIL"}`,
    );
  }
  console.log(`\n저장 위치: fixtures/holdout_candidates/{rec_idx}/`);
  console.log(
    `이 표만 보고 하나 고르면 됨. 고른 뒤 fixtures/holdout/ 으로 이동하고 나머지 삭제.\n`,
  );
}

main().catch((e) => {
  console.error("\n✗ 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
