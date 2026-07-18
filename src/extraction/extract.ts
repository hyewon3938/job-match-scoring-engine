import { callLLM } from "../llm/adapter";
import { EXTRACTION_SYSTEM, buildExtractionPrompt } from "./prompt";
import { EXTRACTION_JSON_SCHEMA, type Extraction } from "./schema";

/** 공고 본문 텍스트 → 요건 구조. §2 경계: LLM은 의미 추출만, 점수는 내지 않는다. */
export async function extract(body: string): Promise<Extraction> {
  const out = await callLLM(buildExtractionPrompt(body), {
    system: EXTRACTION_SYSTEM,
    jsonSchema: EXTRACTION_JSON_SCHEMA,
  });
  return JSON.parse(out) as Extraction;
}
