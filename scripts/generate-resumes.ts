/**
 * STEP4 이력서 생성 — CLAUDE.md §7.
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
// 태도 요건은 명시하지 않고 경험 서술에 녹인다(judge가 의미로 읽어내는지가 관찰 포인트).
const PERSONAS = [
  {
    label: "01-perfect-a",
    spec: "경력 4년차 서버 개발자. AI를 개발 프로세스에 적극 활용하고 자체 AI Harness를 구축해 개발 과정을 자동화한 경험. 서버 개발 경력 3년 이상, Spring Boot 기반 웹 서버 개발 경험. Nginx, Redis, Batch, Kafka, Object Storage 등 인프라 사용 경험. 초기 서비스 준비부터 출시까지 주도한 경험. 글로벌 서비스 개발, 동시성 문제 해결, 대용량 트래픽 처리 및 선제적 이슈 대응, 시스템 장애를 주도적으로 개선한 경험, 결제 연동 개발, 컨테이너 기술 활용, 프론트엔드 경험 일부. 다니던 회사가 한 번 피벗하며 급변하는 상황에 유연하게 대응한 이력도 있음.",
  },
  {
    label: "02-perfect-b",
    spec: "경력 6년차, product engineer에 가까워 제품 전 흐름에 관여한 이력. AI를 적극 활용하고 설계-구현-리뷰-운영을 자동화, 자체 AI Harness 구축 경험. 초기 스타트업에서 서비스를 출시하고 대규모 유저 서비스로 성장시킨 경험, 새로운 기술을 주도적으로 도입한 경험. 서버 개발 경력 3년 이상, Kotlin/Spring Boot 웹 서버 경험, 웹 인프라 전반 이해 및 사용 경험. 한국 서비스를 해외에 현지화해 출시, 대대적 리팩토링으로 모듈화 설계, 대용량 트래픽 선제 이슈 대응, 시스템 성능·장애 모니터링 및 개선, NoSQL 프로젝트, 컨테이너 기술 활용, 프론트 개발 2년 경험.",
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
  console.log(`\n저장: data/resumes/${slug}/ (${PERSONAS.length}명)`);
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
