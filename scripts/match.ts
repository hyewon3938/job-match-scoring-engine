/**
 * 매칭 파이프라인 — 공고 1개 × 이력서 6명 → 캡 적용 랭킹(STEP5).
 * 실행: pnpm tsx scripts/match.ts --job <공고 HTML 경로>
 * 이력서는 data/resumes/<slug>/*.md 를 로드.
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { judge } from "../src/matching/judge";
import { aggregate } from "../src/scoring/aggregate";

function loadEnv() {
  const p = process as unknown as { loadEnvFile?: () => void };
  if (typeof p.loadEnvFile === "function") {
    try {
      p.loadEnvFile();
    } catch {
      /* .env 없음 */
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

async function main() {
  loadEnv();
  const job = jobPath();
  const slug = basename(dirname(job));
  const resumesDir = join(process.cwd(), "data", "resumes", slug);

  console.log("① 공고 추출…");
  const { requirements } = await extract(
    extractBodyText(readFileSync(job, "utf8")),
  );
  const must = requirements.filter((r) => r.type === "must");
  const v = must.filter((r) => r.verify_type === "verifiable").length;
  const jd = must.filter((r) => r.verify_type === "judgment").length;
  const niceN = requirements.filter((r) => r.type === "nice").length;
  console.log(
    `   must ${must.length}(verifiable ${v} / judgment ${jd}) · nice ${niceN}\n`,
  );

  const files = readdirSync(resumesDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const ranked: Array<{ name: string } & ReturnType<typeof aggregate>> = [];
  for (const f of files) {
    const name = f.replace(/\.md$/, "");
    console.log(`② ${name} — 판정…`);
    // 이력서는 원문을 그대로 judge에 넘긴다(구조화는 서사 정보를 손실 — 메모리 resume-raw-vs-structured).
    const resumeText = readFileSync(join(resumesDir, f), "utf8");
    const judgements = await judge(requirements, resumeText);
    ranked.push({ name, ...aggregate(requirements, judgements) });
  }
  ranked.sort((a, b) => b.score - a.score);

  console.log("\n══════ 랭킹 (STEP5 캡 적용) ══════");
  ranked.forEach((r, i) => {
    console.log(
      `\n[${i + 1}위] ${r.name} — ${r.score}점${r.cap !== null ? `  (천장 ${r.cap})` : ""}`,
    );
    console.log(`   ${r.summary}`);
    console.log(`   → ${r.capReason}`);
    const miss = r.details.filter((d) => d.type === "must" && !d.met);
    for (const d of miss) {
      console.log(
        `   ✗ [${d.verify_type}] ${d.raw.slice(0, 26)} — ${d.evidence.slice(0, 32)}`,
      );
    }
  });
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
