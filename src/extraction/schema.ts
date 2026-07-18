/**
 * STEP2 최소 추출 스키마 — raw / type / confidence 3필드만.
 * CLAUDE.md §4의 full 스키마(basis · atoms · conflicts · excluded 등)는 STEP3에서 정교화.
 */
export type ReqType = "must" | "nice" | "unknown";

export interface Requirement {
  raw: string; // 원문 그대로(요약·정규화 금지 — 근거 추적용)
  type: ReqType; // must | nice | unknown — 억지 이진분류 금지
  confidence: number; // 0.0 ~ 1.0
}

export interface Extraction {
  requirements: Requirement[];
}

/** OpenAI structured output용 JSON schema(strict). */
export const EXTRACTION_JSON_SCHEMA = {
  name: "extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["requirements"],
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["raw", "type", "confidence"],
          properties: {
            raw: { type: "string" },
            type: { type: "string", enum: ["must", "nice", "unknown"] },
            confidence: { type: "number" },
          },
        },
      },
    },
  },
} as const;
