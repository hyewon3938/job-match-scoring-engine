/**
 * STEP4 파이프라인 — 공고 1개 × 이력서 6명.
 * 실행: pnpm tsx scripts/match.ts --job <공고 HTML 경로>
 * 이력서는 data/resumes/<slug>/*.md 를 로드(생성은 generate-resumes.ts).
 *
 * ⚠️ 캡 없음(STEP2 단순 비율 집계). 순위가 이상해도 정상 — 캡·게이팅은 STEP5.
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { extractResume } from "../src/extraction/extract-resume";
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
  const cnt = (t: string) => requirements.filter((r) => r.type === t).length;
  console.log(
    `   요건 ${requirements.length} — must ${cnt("must")} / nice ${cnt("nice")} / unknown ${cnt("unknown")}\n`,
  );

  const files = readdirSync(resumesDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const ranked: Array<{ name: string } & ReturnType<typeof aggregate>> = [];
  for (const f of files) {
    const name = f.replace(/\.md$/, "");
    console.log(`② ${name} — 이력서 구조화 + 판정…`);
    const structured = await extractResume(
      readFileSync(join(resumesDir, f), "utf8"),
    );
    // §2: 이력서 구조를 판정에 넘긴다. judge/스코어러는 건드리지 않는다.
    const judgements = await judge(
      requirements,
      JSON.stringify(structured, null, 2),
    );
    ranked.push({ name, ...aggregate(requirements, judgements) });
  }
  ranked.sort((a, b) => b.score - a.score);

  console.log("\n══════ 랭킹 (캡 없음 — STEP5 전) ══════");
  ranked.forEach((r, i) => {
    console.log(
      `\n[${i + 1}위] ${r.name} — ${r.score}점  (필수 ${r.mustMet}/${r.mustTotal}, 우대 ${r.niceMet}/${r.niceTotal})`,
    );
    const missMust = r.details.filter((d) => d.type === "must" && !d.met);
    if (missMust.length) {
      console.log(
        `     미충족 필수: ${missMust.map((d) => d.raw.slice(0, 22)).join(" / ")}`,
      );
    }
  });
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
