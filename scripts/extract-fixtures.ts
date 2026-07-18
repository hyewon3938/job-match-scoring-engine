/**
 * 개발용 러너 — fixtures의 body.txt를 추출 엔진에 넣고 결과를 눈으로 확인한다.
 * (설계 로그 G/H: "실행해서 눈으로 확인"이 추출 단계의 필수 절차.)
 *
 * 실행: npx tsx scripts/extract-fixtures.ts [<fixture-dir> ...]
 * 기본 대상: 네이버웹툰(주 JD) + zuzu(엣지 케이스).
 * 결과: 각 fixture 폴더에 extraction.json 기록 + 콘솔 요약.
 *
 * .env는 조용히 로드한다(stdout으로 값 덤프하지 않음).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractRequirements } from "../src/extraction/extract";
import { verifyExtraction } from "../src/extraction/verify";
import type { Extraction } from "../src/extraction/schema";

function loadEnvQuietly() {
  const anyProc = process as unknown as { loadEnvFile?: (p?: string) => void };
  if (typeof anyProc.loadEnvFile === "function") {
    try {
      anyProc.loadEnvFile();
      return;
    } catch {
      /* .env 없음 — 무시 */
    }
  }
  // 구버전 Node 폴백: 값은 process.env로만 들어가고 절대 출력하지 않는다.
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, k] = m;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* .env 없음 — 무시 */
  }
}

const POSTINGS = join(process.cwd(), "fixtures", "postings");
const DEFAULT_TARGETS = [
  "54352607-naver-webtoon-disney-server",
  "54001953-zuzu-software-engineer",
];

function summarize(
  dir: string,
  ex: Extraction,
  flags: ReturnType<typeof verifyExtraction>,
) {
  const byTier = (t: string) => ex.requirements.filter((r) => r.tier === t);
  const line = "─".repeat(72);
  console.log(`\n${line}\n▶ ${dir}`);
  console.log(`  jobTitle : ${ex.jobTitle}`);
  const e = ex.experience;
  console.log(
    `  연차     : ${
      e
        ? `min=${e.minYears} max=${e.maxYears} 신입가능=${e.newGradeEligible}  ← "${e.raw}"`
        : "null"
    }`,
  );
  console.log(
    `  요건     : required ${byTier("required").length} / preferred ${byTier("preferred").length} / unknown ${byTier("unknown").length}`,
  );
  for (const r of ex.requirements) {
    const dur = r.durationYears != null ? ` [${r.durationYears}년]` : "";
    console.log(
      `    · [${r.tier}/${r.confidence}] (${r.sectionTitle ?? "제목없음"}) ${r.text}${dur}`,
    );
  }
  console.log(`  conflicts: ${ex.conflicts.length}`);
  for (const c of ex.conflicts) {
    console.log(`    ⚠ ${c.axis}: ${c.note}`);
    for (const s of c.statements) console.log(`        - ${s}`);
  }
  console.log(
    `  dropped  : ${ex.droppedSections.map((d) => d.title).join(", ") || "(없음)"}`,
  );
  console.log(
    `  검증     : ${flags.length === 0 ? "✅ 모든 스팬 원문 대조 통과" : `⚠ ${flags.length}건 원문 미검출`}`,
  );
  for (const f of flags) console.log(`    ✗ ${f.kind}: ${f.text}`);
}

async function main() {
  loadEnvQuietly();
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "ANTHROPIC_API_KEY(또는 AUTH_TOKEN)를 찾지 못했습니다. .env에 있거나 셸에 export되어 있어야 합니다.",
    );
    process.exit(1);
  }

  const targets = process.argv.slice(2).length
    ? process.argv.slice(2)
    : DEFAULT_TARGETS;

  for (const t of targets) {
    const dir = t.includes("/") ? t : join(POSTINGS, t);
    const bodyPath = join(dir, "body.txt");
    let body: string;
    try {
      body = readFileSync(bodyPath, "utf8");
    } catch {
      console.error(`body.txt 없음: ${bodyPath}`);
      continue;
    }
    try {
      const ex = await extractRequirements({
        text: body,
        source: "saramin:body.txt",
      });
      const flags = verifyExtraction(body, ex);
      writeFileSync(
        join(dir, "extraction.json"),
        JSON.stringify(ex, null, 2) + "\n",
        "utf8",
      );
      summarize(t, ex, flags);
    } catch (err) {
      console.error(
        `\n✗ ${t} 추출 실패:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

main();
