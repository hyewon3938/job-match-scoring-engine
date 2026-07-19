import { callLLM } from "../llm/adapter";
import { loadExtractionSystem, buildExtractionPrompt } from "./prompt";
import {
  EXTRACTION_JSON_SCHEMA,
  type Extraction,
  type Requirement,
} from "./schema";

/**
 * 추출 모델 = gpt-4o (OPENAI_EXTRACT_MODEL로 교체 가능).
 * 근거: 추출은 공고당 1콜이라 비용이 무시 가능한데, 그 출력이 스코어링 전체의 계약이 된다.
 */
const EXTRACT_MODEL = process.env.OPENAI_EXTRACT_MODEL ?? "gpt-4o";

type LlmRequirement = Omit<Requirement, "id">;
type LlmExtraction = Omit<Extraction, "requirements"> & {
  requirements: LlmRequirement[];
};

/** 공고 본문 → 구조화 요건(§4). id는 코드가 부여한다. */
export async function extract(body: string): Promise<Extraction> {
  const out = await callLLM(buildExtractionPrompt(body), {
    system: loadExtractionSystem(),
    model: EXTRACT_MODEL,
    jsonSchema: EXTRACTION_JSON_SCHEMA,
  });
  const parsed = JSON.parse(out) as LlmExtraction;
  return {
    ...parsed,
    requirements: parsed.requirements.map((r, i) => ({
      id: `r${i + 1}`,
      ...r,
    })),
  };
}
