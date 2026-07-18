import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callLLM } from "../llm/adapter";
import type { Requirement } from "../extraction/schema";

export type Strength = "direct" | "partial" | "related" | "none";

/** 요건별 충족 강도 판정. index = 입력 요건 번호(1-based). */
export interface Judgement {
  index: number;
  strength: Strength;
  evidence: string; // 근거가 된 문장/사실 한 줄
}

/**
 * 판정 지침은 prompts/judge.md에서 로드한다.
 * §3 하드코딩 금지 — 지침에는 표기가 달라도 같은 스킬로 보라는 도메인 예시가 들어가는데,
 * 이는 LLM에게 판정 '방법'을 가르치는 지시문이지 코드가 쥔 사전이 아니다.
 * src/ 안에 도메인 문자열을 남기지 않기 위해 프롬프트로 분리한다(extract 프롬프트와 동일 원칙).
 */
function loadJudgeSystem(): string {
  return readFileSync(
    join(process.cwd(), "prompts", "judge.md"),
    "utf8",
  ).trimEnd();
}

const JUDGE_SCHEMA = {
  name: "judgements",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["judgements"],
    properties: {
      judgements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "strength", "evidence"],
          properties: {
            index: { type: "integer" },
            strength: {
              type: "string",
              enum: ["direct", "partial", "related", "none"],
            },
            evidence: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/** 요건 목록 × 이력서 원문 → 요건별 충족 강도 판정(§2: LLM은 의미 판정만). */
export async function judge(
  requirements: Requirement[],
  resume: string,
): Promise<Judgement[]> {
  const list = requirements.map((r, i) => `${i + 1}. ${r.raw}`).join("\n");
  const prompt = `<요건목록>\n${list}\n</요건목록>\n\n<이력서>\n${resume}\n</이력서>\n\n각 요건의 충족 강도를 판정하라.`;
  const out = await callLLM(prompt, {
    system: loadJudgeSystem(),
    model: process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o",
    jsonSchema: JUDGE_SCHEMA,
  });
  return JSON.parse(out).judgements as Judgement[];
}
