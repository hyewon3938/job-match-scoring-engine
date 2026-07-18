/**
 * STEP2 얇은 E2E 러너 — 공고 1개 × 이력서 2명을 끝까지 한 번 돌린다.
 * 실행: pnpm tsx scripts/match.ts --job <공고 HTML 경로>
 * 예:   pnpm tsx scripts/match.ts --job fixtures/postings/54259129-inflearn-frontend/view-detail.html
 *
 * 이력서 2명은 지금 코드에 인라인(STEP2 임시). 생성 파이프라인·6명·홀드아웃은 이후 단계.
 */
import { readFileSync } from "node:fs";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { judge } from "../src/matching/judge";
import { aggregate } from "../src/scoring/aggregate";

/** .env를 조용히 로드(값은 stdout에 찍지 않는다). */
function loadEnv() {
  const p = process as unknown as { loadEnvFile?: () => void };
  if (typeof p.loadEnvFile === "function") {
    try {
      p.loadEnvFile();
    } catch {
      /* .env 없음 — 무시 */
    }
  }
}

function jobPath(): string {
  const i = process.argv.indexOf("--job");
  const p = i >= 0 ? process.argv[i + 1] : undefined;
  if (!p) {
    console.error("사용법: pnpm tsx scripts/match.ts --job <공고 HTML 경로>");
    process.exit(1);
  }
  return p;
}

// 하드코딩 이력서 2명(STEP2 임시).
//  완벽형: 공고 용어를 그대로 안 쓰고 동의어·다른 표기로 충족.
//  미스형: 키워드는 겹치되 실질 미달(§7 리트머스 — 키워드 매칭은 통과, 의미 판정만 걸러냄).
const RESUMES: { name: string; text: string }[] = [
  {
    name: "완벽형",
    text: `프론트엔드 5년차. 리액트와 타입스크립트로 대규모 웹 서비스를 만들었다. Next.js 기반 SSR/SPA, 사내 디자인시스템 구축, 렌더링 성능 최적화(LCP 개선) 경험. 주니어 코드리뷰와 팀 리딩도 맡았다.`,
  },
  {
    name: "미스형",
    text: `퍼포먼스 마케팅 대행사에서 3년간 광고를 운영했다. HTML/CSS로 간단한 랜딩페이지를 만든 적 있고, React는 부트캠프 3개월 과정에서 잠깐 배웠다. 실무 개발 경험은 없다.`,
  },
];

async function main() {
  loadEnv();
  const html = readFileSync(jobPath(), "utf8");
  const body = extractBodyText(html);

  console.log("① 공고 추출 중…");
  const { requirements } = await extract(body);
  const cnt = (t: string) => requirements.filter((r) => r.type === t).length;
  console.log(
    `   요건 ${requirements.length}개 — must ${cnt("must")} / nice ${cnt("nice")} / unknown ${cnt("unknown")}\n`,
  );

  const ranked = [];
  for (const r of RESUMES) {
    console.log(`② ${r.name} 판정 중…`);
    const judgements = await judge(requirements, r.text);
    ranked.push({ name: r.name, ...aggregate(requirements, judgements) });
  }
  ranked.sort((a, b) => b.score - a.score);

  console.log("\n══════ 랭킹 ══════");
  ranked.forEach((r, i) => {
    console.log(
      `\n[${i + 1}위] ${r.name} — ${r.score}점  (필수 ${r.mustMet}/${r.mustTotal}, 우대 ${r.niceMet}/${r.niceTotal})`,
    );
    for (const d of r.details) {
      const head = d.raw.length > 45 ? d.raw.slice(0, 45) + "…" : d.raw;
      console.log(`   ${d.met ? "✓" : "✗"} [${d.type}] ${head}`);
      console.log(`        └ ${d.evidence}`);
    }
  });
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
