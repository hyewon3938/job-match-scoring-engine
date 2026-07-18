/**
 * 매칭 파이프라인 — 공고 1개 × 이력서 6명 → 캡 적용 랭킹(STEP5).
 * 실행: pnpm tsx scripts/match.ts --job <공고 HTML 경로>
 * 콘솔 랭킹 + UI용 result.json(프로젝트 루트)을 출력한다.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  const extraction = await extract(extractBodyText(readFileSync(job, "utf8")));
  const requirements = extraction.requirements;
  const must = requirements.filter((r) => r.type === "must");
  const v = must.filter((r) => r.verify_type === "verifiable").length;
  const jd = must.filter((r) => r.verify_type === "judgment").length;
  const niceN = requirements.filter((r) => r.type === "nice").length;
  console.log(`   ${extraction.company} — ${extraction.title}`);
  console.log(
    `   must ${must.length}(verifiable ${v} / judgment ${jd}) · nice ${niceN}\n`,
  );

  const files = readdirSync(resumesDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const ranked: Array<
    { name: string; resumeText: string } & ReturnType<typeof aggregate>
  > = [];
  for (const f of files) {
    const name = f.replace(/\.md$/, "");
    console.log(`② ${name} — 판정…`);
    const resumeText = readFileSync(join(resumesDir, f), "utf8");
    const judgements = await judge(requirements, resumeText);
    ranked.push({ name, resumeText, ...aggregate(requirements, judgements) });
  }
  ranked.sort((a, b) => b.score - a.score);

  console.log("\n══════ 랭킹 (STEP5 캡 적용) ══════");
  ranked.forEach((r, i) => {
    console.log(
      `\n[${i + 1}위] ${r.name} — ${r.score}점${r.cap !== null ? `  (천장 ${r.cap})` : ""}`,
    );
    console.log(`   ${r.summary}`);
  });

  // UI용 result.json — 판정 결과를 정적으로 담아 page.tsx가 LLM 재호출 없이 표시.
  const result = {
    job: {
      company: extraction.company,
      title: extraction.title,
      jobCategory: extraction.job_category,
      requirements: requirements.map((r) => ({
        raw: r.raw,
        type: r.type,
        verify_type: r.verify_type,
      })),
    },
    ranked: ranked.map((r) => ({
      name: r.name,
      score: r.score,
      cap: r.cap,
      capReason: r.capReason,
      vMustMet: r.vMustMet,
      vMustTotal: r.vMustTotal,
      jMustMet: r.jMustMet,
      jMustTotal: r.jMustTotal,
      niceMet: r.niceMet,
      niceTotal: r.niceTotal,
      details: r.details,
      resumeText: r.resumeText,
    })),
  };
  writeFileSync(
    join(process.cwd(), "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("\n→ result.json 저장 (UI용)");
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
