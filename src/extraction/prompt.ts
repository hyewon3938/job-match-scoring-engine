import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 추출 지시문은 prompts/extract_job.md에서 로드한다.
 * 코드에 인라인하지 않는다 — 프롬프트 튜닝을 코드 수정과 분리하기 위함.
 */
export function loadExtractionSystem(): string {
  return readFileSync(join(process.cwd(), "prompts", "extract_job.md"), "utf8");
}

export function buildExtractionPrompt(body: string): string {
  return `다음 공고 본문에서 위 규칙에 따라 요건을 추출하라.\n\n<공고본문>\n${body}\n</공고본문>`;
}
