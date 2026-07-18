/**
 * 추출 결과를 지표로 검사하는 러너(스코어러는 건드리지 않는다).
 * 실행: pnpm tsx scripts/inspect-extract.ts --job <공고 HTML 경로>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";

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
    console.error(
      "사용법: pnpm tsx scripts/inspect-extract.ts --job <공고 HTML 경로>",
    );
    process.exit(1);
  }
  return p;
}

async function main() {
  loadEnv();
  const path = jobPath();
  const body = extractBodyText(readFileSync(path, "utf8"));
  const ex = await extract(body);

  const reqs = ex.requirements;
  const count = (pred: (r: (typeof reqs)[number]) => boolean) =>
    reqs.filter(pred).length;

  console.log(
    `\n회사/직무: ${ex.company} — ${ex.title}  [job_category: ${ex.job_category}]`,
  );

  // 1. requirements 개수
  console.log(`\n① requirements: ${reqs.length}개`);

  // 2. type 분포
  console.log(
    `② type — must ${count((r) => r.type === "must")} / nice ${count((r) => r.type === "nice")} / unknown ${count((r) => r.type === "unknown")}`,
  );

  // 3. confidence 분포 (구간별) + basis 분포
  const bins: Record<string, number> = {
    ">=0.9": 0,
    "0.8~0.9": 0,
    "0.6~0.8": 0,
    "0.5~0.6": 0,
    "<0.5": 0,
  };
  for (const r of reqs) {
    const c = r.confidence;
    if (c >= 0.9) bins[">=0.9"]++;
    else if (c >= 0.8) bins["0.8~0.9"]++;
    else if (c >= 0.6) bins["0.6~0.8"]++;
    else if (c >= 0.5) bins["0.5~0.6"]++;
    else bins["<0.5"]++;
  }
  const basisDist: Record<string, number> = {};
  for (const r of reqs) basisDist[r.basis] = (basisDist[r.basis] ?? 0) + 1;
  console.log(`③ confidence — ${JSON.stringify(bins)}`);
  console.log(`   basis      — ${JSON.stringify(basisDist)}`);

  // 4. excluded 개수 + 샘플 5
  console.log(`\n④ excluded: ${ex.excluded.length}개`);
  ex.excluded
    .slice(0, 5)
    .forEach((e) =>
      console.log(`   · "${e.text.slice(0, 32)}…" → ${e.reason}`),
    );

  // 5. conflicts 전부
  console.log(`\n⑤ conflicts: ${ex.conflicts.length}개`);
  ex.conflicts.forEach((c) =>
    console.log(
      `   ⚠ [${c.axis}] ${c.a.text} ⟷ ${c.b.text}  → ${c.resolution} (${c.rule})`,
    ),
  );

  console.log(`\n담당업무(responsibilities): ${ex.responsibilities.length}개`);
  ex.responsibilities
    .slice(0, 3)
    .forEach((r) => console.log(`   · ${r.raw.slice(0, 42)} [${r.section}]`));
  console.log(`회사소개(company_intro): ${ex.company_intro.length}개`);
  ex.company_intro
    .slice(0, 3)
    .forEach((r) => console.log(`   · ${r.raw.slice(0, 42)} [${r.section}]`));
  console.log(`(참고) implied_stack: ${ex.implied_stack.length}개`);
  console.log(`\n── 필수(must) verify_type 분류 ──`);
  console.log(`  ${"verify_type".padEnd(12)}${"category".padEnd(12)}raw`);
  for (const r of reqs.filter((x) => x.type === "must")) {
    console.log(
      `  ${r.verify_type.padEnd(12)}${r.category.padEnd(12)}${r.raw.slice(0, 40)}`,
    );
  }
  console.log(`\n── 요건 목록 ──`);
  for (const r of reqs) {
    console.log(
      `  [${r.type}/${r.verify_type}/${r.confidence}/${r.basis}] ${r.raw.slice(0, 46)}`,
    );
  }

  const outPath = join(dirname(path), "extraction.json");
  writeFileSync(outPath, JSON.stringify(ex, null, 2) + "\n");
  console.log(`\n결과 저장: ${outPath}`);
}

main().catch((e) => {
  console.error("\n실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
