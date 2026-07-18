/**
 * 이력서 구조 스키마 — 공고 요건 스키마와 독립.
 * §2 아키텍처: 이력서 원문 → (이 구조) → 충족 판정. 공고 스키마를 참조하지 않는다.
 */
export interface ResumeSkill {
  name: string; // 이력서 표기 그대로
  level: string | null;
  years: number | null;
  context: string | null; // "부트캠프 3개월" 등 판정에 중요한 단서
}
export interface ResumeExperience {
  role: string;
  domain: string | null;
  years: number | null;
  is_professional: boolean; // 실무 경력 여부(학습/사이드와 구분)
  description: string;
}
export interface ResumeStructure {
  summary: string;
  skills: ResumeSkill[];
  experiences: ResumeExperience[];
  education: string[];
  others: string[];
}

const str = { type: "string" } as const;
const strOrNull = { type: ["string", "null"] } as const;

export const RESUME_JSON_SCHEMA = {
  name: "resume_structure",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "skills", "experiences", "education", "others"],
    properties: {
      summary: str,
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "level", "years", "context"],
          properties: {
            name: str,
            level: strOrNull,
            years: { type: ["number", "null"] },
            context: strOrNull,
          },
        },
      },
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "domain",
            "years",
            "is_professional",
            "description",
          ],
          properties: {
            role: str,
            domain: strOrNull,
            years: { type: ["number", "null"] },
            is_professional: { type: "boolean" },
            description: str,
          },
        },
      },
      education: { type: "array", items: str },
      others: { type: "array", items: str },
    },
  },
} as const;
