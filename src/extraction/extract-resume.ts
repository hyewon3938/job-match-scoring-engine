import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callLLM } from "../llm/adapter";
import { RESUME_JSON_SCHEMA, type ResumeStructure } from "./resume-schema";

/** 이력서 추출 = gpt-4o-mini(경량). 공고 추출(gpt-4o)과 별도 프롬프트·모델. */
const RESUME_MODEL = process.env.OPENAI_RESUME_MODEL ?? "gpt-4o-mini";

function loadSystem(): string {
  return readFileSync(
    join(process.cwd(), "prompts", "extract_resume.md"),
    "utf8",
  );
}

/** 이력서 원문 → 구조. 공고 요건을 참조하지 않는다(독립 해석). */
export async function extractResume(
  resumeText: string,
): Promise<ResumeStructure> {
  const out = await callLLM(`<이력서>\n${resumeText}\n</이력서>`, {
    system: loadSystem(),
    model: RESUME_MODEL,
    jsonSchema: RESUME_JSON_SCHEMA,
  });
  return JSON.parse(out) as ResumeStructure;
}
