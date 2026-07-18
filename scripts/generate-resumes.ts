/**
 * STEP4 이력서 6명 생성 — CLAUDE.md §7.
 * 실행: pnpm tsx scripts/generate-resumes.ts --job <공고 HTML 경로>
 *
 * 🚨 순환논리 차단(§7): 이 스크립트는 공고 "원문 텍스트"만 읽는다.
 *    추출 결과(extraction.json)를 import하지 않는다 — 스키마를 보고 이력서를 쓰면
 *    자기가 낸 문제를 자기가 푸는 꼴이라 매칭 검증이 무의미해진다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { extractBodyText } from "../src/crawler";
import { callLLM } from "../src/llm/adapter";

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
      "사용법: pnpm tsx scripts/generate-resumes.ts --job <공고 HTML 경로>",
    );
    process.exit(1);
  }
  return p;
}

// 생성은 gpt-4o(현실적 서술). 판정/이력서추출은 경량 모델과 별개.
const MODEL = process.env.OPENAI_GENERATE_MODEL ?? "gpt-4o";

// 페르소나 = 정답 라벨(랭킹 테스트 기대값). 파일명에 그대로 반영.
const PERSONAS = [
  {
    label: "01-perfect-a",
    spec: "이 공고의 필수 자격과 우대 경험을 모두 갖춘 5년차급 지원자. 공고 기술 용어를 그대로 쓰지 말고 동의어·다른 표기로. 이전 직장/이직 사유 등 노이즈 포함.",
  },
  {
    label: "02-perfect-b",
    spec: "필수·우대를 모두 충족하되 A와 다른 배경(다른 산업 도메인 출신, 다른 커리어 경로)의 지원자. 표현은 공고와 다르게.",
  },
  {
    label: "03-must-only",
    spec: "필수 자격은 모두 충족하지만 우대 경험(심화·부가 기술)은 전혀 해당 없는 실무 지원자.",
  },
  {
    label: "04-cap-test-miss1must",
    spec: "우대 경험은 모두 갖췄지만, 공고의 필수 자격 중 정확히 하나를 충족하지 못하는 지원자. 그 하나는 이력서에서 명확히 부재하게(언급조차 없게) 하라.",
  },
  {
    label: "05-underqualified",
    spec: "필수 자격 대부분을 형식적으로 언급하나 실무 경험·연차가 부족한 지원자. 관련 업무를 학습·단기로만 접했거나 핵심 경력이 짧게.",
  },
  {
    label: "06-mismatch",
    spec: "표면적으로 공고 핵심 키워드와 겹치는 단어가 이력서에 등장하지만 실질은 미달인 지원자. 예: 핵심 기술을 부트캠프/사이드로만 접했고 주 경력은 무관 직무 3년. 완전 무관자가 아니라 '키워드는 걸리되 실질 미달'.",
  },
];

async function main() {
  loadEnv();
  const job = jobPath();
  const slug = basename(dirname(job));
  const body = extractBodyText(readFileSync(job, "utf8"));
  const outDir = join(process.cwd(), "data", "resumes", slug);
  mkdirSync(outDir, { recursive: true });
  const system = readFileSync(
    join(process.cwd(), "prompts", "generate_resume.md"),
    "utf8",
  );

  for (const p of PERSONAS) {
    const user = `<공고원문>\n${body}\n</공고원문>\n\n[페르소나] ${p.spec}\n\n위 공고 원문을 바탕으로, 지정된 페르소나의 지원자 이력서를 자연어(마크다운)로 작성하라.`;
    const md = await callLLM(user, { system, model: MODEL });
    writeFileSync(join(outDir, `${p.label}.md`), md.trim() + "\n");
    console.log(`✓ ${p.label}.md (${md.length} chars)`);
  }
  console.log(`\n저장: data/resumes/${slug}/ (6명)`);
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
