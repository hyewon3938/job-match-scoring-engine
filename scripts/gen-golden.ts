/**
 * ④ 골든 픽스처의 고정 LLM 응답을 로컬 캐시에서 한 번 꺼내 박아넣는다.
 * 실행: pnpm tsx scripts/gen-golden.ts  (extract/judge가 이미 캐시에 있어 API 미호출)
 * 재생성이 필요한 경우(프롬프트·스키마 변경 등)에만 다시 돌린다.
 *
 * 대표 3케이스: 완벽(전부 direct·캡 없음) / judgment 감점(verifiable 3/3·태도 약함) / verifiable 미충족(캡).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { judge } from "../src/matching/judge";

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

const ROOT = process.cwd();
const SLUG = "54352607-naver-webtoon-disney-server";
const CASES = [
  "01-perfect-a",
  "04-cap-attitude-miss",
  "05-cap-verifiable-miss",
];

async function main() {
  loadEnv();
  const html = readFileSync(
    join(ROOT, "fixtures/postings", SLUG, "view-detail.html"),
    "utf8",
  );
  const extraction = await extract(extractBodyText(html));

  const golden: {
    extract: string;
    judges: { name: string; resume: string; response: string }[];
  } = { extract: JSON.stringify(extraction), judges: [] };

  for (const name of CASES) {
    const resume = readFileSync(
      join(ROOT, "data/resumes", SLUG, `${name}.md`),
      "utf8",
    );
    const judgements = await judge(extraction.requirements, resume);
    golden.judges.push({
      name,
      resume,
      response: JSON.stringify({ judgements }),
    });
  }

  mkdirSync(join(ROOT, "tests/fixtures"), { recursive: true });
  writeFileSync(
    join(ROOT, "tests/fixtures/golden-llm-responses.json"),
    JSON.stringify(golden, null, 2) + "\n",
  );
  console.log(
    `golden 생성: extract 1 + judge ${golden.judges.length} (${CASES.join(", ")})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
