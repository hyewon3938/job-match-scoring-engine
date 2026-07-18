import { callLLM } from "../llm/adapter";
import type { Requirement } from "../extraction/schema";

/** 요건별 충족 판정 결과. index = 입력 요건 번호(1-based). */
export interface Judgement {
  index: number;
  met: boolean;
  evidence: string; // 이력서에서 근거가 된 문장/사실 한 줄
}

const JUDGE_SYSTEM = `당신은 지원자 이력서가 채용 요건을 충족하는지 판정하는 엔진이다.
- 각 요건마다 met(true/false)와 evidence(이력서에서 근거가 된 문장/사실 한 줄)를 낸다.
- 표현이 달라도 의미가 같으면 충족으로 본다(예: "리액트"="React", "SPA 개발"="프론트엔드 경험"). 키워드 일치가 아니라 의미로 판단한다.
- 근거가 이력서에 없으면 met=false, evidence는 "근거 없음".
- index는 입력 요건 번호를 그대로 쓰고, 모든 요건에 대해 하나씩 빠짐없이 낸다.
반드시 주어진 JSON 스키마로만 출력한다.`;

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
          required: ["index", "met", "evidence"],
          properties: {
            index: { type: "integer" },
            met: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/** 요건 목록 × 이력서 텍스트 → 요건별 충족 판정(§2: LLM은 의미 판정만). */
export async function judge(
  requirements: Requirement[],
  resume: string,
): Promise<Judgement[]> {
  const list = requirements.map((r, i) => `${i + 1}. ${r.raw}`).join("\n");
  const prompt = `<요건목록>\n${list}\n</요건목록>\n\n<이력서>\n${resume}\n</이력서>\n\n각 요건의 충족 여부를 판정하라.`;
  const out = await callLLM(prompt, {
    system: JUDGE_SYSTEM,
    jsonSchema: JUDGE_SCHEMA,
  });
  return JSON.parse(out).judgements as Judgement[];
}
