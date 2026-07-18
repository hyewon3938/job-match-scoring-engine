import { callLLM } from "../llm/adapter";
import type { Requirement } from "../extraction/schema";

export type Strength = "direct" | "partial" | "related" | "none";

/** 요건별 충족 강도 판정. index = 입력 요건 번호(1-based). */
export interface Judgement {
  index: number;
  strength: Strength;
  evidence: string; // 근거가 된 문장/사실 한 줄
}

const JUDGE_SYSTEM = `당신은 지원자 이력서가 채용 요건을 얼마나 충족하는지 판정하는 엔진이다.
각 요건마다 strength(충족 강도)와 evidence(근거 한 줄)를 낸다.

[strength 기준]
- direct: 표현이 달라도 요건을 직접 충족한다. (예: "리액트"="React", "PG 3사 연동"="결제 연동 개발")
- partial: 일부만 충족한다. (예: "Docker·Kubernetes 운영" 요건에 Docker만 있고 K8s는 없음)
- related: 주제는 관련 있으나 요건 자체는 충족하지 않는다.
- none: 근거가 이력서에 없다.

⚠️ 관련성과 충족을 반드시 구분하라.
- "결제 장애를 추적했다"는 "대규모 모듈화 설계 주도"와 주제만 관련될 뿐 충족은 아니다 → related.
- "컴플라이언스 문서를 읽는다"는 "글로벌 인프라 설계"를 충족하지 않는다 → related.
표현이 달라도 의미가 요건을 직접 충족하면 direct다. 하나의 경험이 여러 요건을 각각 direct로 충족할 수 있다(중복 허용).

[나열형·전반 요건] "전반적 이해", "~ 등", 여러 기술을 나열한 요건(예: "웹 인프라 전반적 이해(Nginx, Redis, RDB, Batch, Kafka, Object Storage 등)")은 나열 항목을 전부 커버할 필요가 없다. 나열된 것 중 복수를 실제로 다루면 direct로 본다. 완전 일치를 요구하지 마라.

index는 입력 요건 번호를 그대로 쓰고, 모든 요건에 하나씩 빠짐없이 낸다.
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
    system: JUDGE_SYSTEM,
    model: process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o",
    jsonSchema: JUDGE_SCHEMA,
  });
  return JSON.parse(out).judgements as Judgement[];
}
