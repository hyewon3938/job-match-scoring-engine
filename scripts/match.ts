/**
 * 매칭 파이프라인 — 공고 1개 × 이력서 N명 → 캡 적용 랭킹(STEP5).
 * 실행: pnpm tsx scripts/match.ts --job <공고 HTML 경로>
 * 콘솔 랭킹 + UI용 result/{slug}.json 을 출력한다(공고별로 저장 → UI에서 공고 선택).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { judge } from "../src/matching/judge";
import { aggregate } from "../src/scoring/aggregate";
import type { Extraction } from "../src/extraction/schema";

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

type Input = { mode: "job" | "extracted"; path: string };

/**
 * 두 진입점:
 * - --extracted <JSON>: 저장된 추출 결과로 매칭만 재실행(공고 원문·추출 불필요 — 채점자용).
 * - --job <HTML>: 공고 원문에서 추출부터(원문 필요 — 로컬 개발용). 추출 결과를 extracted/ 에 저장한다.
 */
function parseArgs(): Input {
  const argv = process.argv;
  const ei = argv.indexOf("--extracted");
  if (ei >= 0 && argv[ei + 1]) return { mode: "extracted", path: argv[ei + 1] };
  const ji = argv.indexOf("--job");
  if (ji >= 0 && argv[ji + 1]) return { mode: "job", path: argv[ji + 1] };
  console.error(
    "사용법:\n" +
      "  pnpm tsx scripts/match.ts --extracted <추출JSON>   # 매칭만(원문 불필요, 채점자용)\n" +
      "  pnpm tsx scripts/match.ts --job <공고 HTML>        # 추출부터(원문 필요, 로컬 개발용)",
  );
  process.exit(1);
}

async function main() {
  loadEnv();
  const input = parseArgs();

  let extraction: Extraction;
  let slug: string;
  if (input.mode === "extracted") {
    slug = basename(input.path, ".json");
    extraction = JSON.parse(readFileSync(input.path, "utf8")) as Extraction;
    console.log(`① 추출 결과 로드 — ${input.path}`);
  } else {
    slug = basename(dirname(input.path));
    console.log("① 공고 추출…");
    extraction = await extract(
      extractBodyText(readFileSync(input.path, "utf8")),
    );
    // 추출 결과를 커밋 가능한 파생물로 저장 → 채점자는 원문 없이 --extracted 로 재실행한다.
    const exDir = join(process.cwd(), "extracted");
    mkdirSync(exDir, { recursive: true });
    writeFileSync(
      join(exDir, `${slug}.json`),
      JSON.stringify(extraction, null, 2) + "\n",
    );
    console.log(`   추출 결과 저장 → extracted/${slug}.json`);
  }

  const resumesDir = join(process.cwd(), "data", "resumes", slug);
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

  const result = {
    slug,
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
      summary: r.summary,
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
  const outDir = join(process.cwd(), "result");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `${slug}.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(`\n→ result/${slug}.json 저장 (UI용)`);
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
