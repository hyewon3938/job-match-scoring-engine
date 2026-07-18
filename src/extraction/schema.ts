/**
 * 공고 추출 스키마 — CLAUDE.md §4 + verify_type(STEP5).
 * LLM은 "충족/미충족 + 근거"와 이 구조화만 담당하고 점수는 내지 않는다(§2).
 * id는 LLM이 아니라 코드가 부여한다(안정적 참조). 그래서 JSON schema에는 id가 없다.
 */
export type ReqType = "must" | "nice" | "unknown";
export type Basis =
  | "explicit_header"
  | "explicit_phrase"
  | "block_boundary"
  | "phrasing_pattern"
  | "none";
export type Category =
  "skill" | "experience" | "domain" | "soft" | "education" | "other";
export type AtomKind =
  "skill" | "role" | "domain" | "years" | "credential" | "trait" | "activity";

/**
 * 요건의 검증 성질(STEP5). 캡 축을 나누는 근거.
 * - verifiable: 있냐/없냐로 판정 가능(스킬·연차·자격증·특정 경험 유무) → 캡 축
 * - judgment: 정성 판단 필요(태도·성향·컬처핏) → judge가 불안정하므로 캡 아님, 감점으로만
 */
export type VerifyType = "verifiable" | "judgment";

export interface Atom {
  kind: AtomKind;
  text: string;
  scope: string | null; // kind=years면 "무엇의 연차인지" 필수
  years: number | null; // kind=years면 숫자
  op: string | null; // ">=", "<=" 등
}

export interface Requirement {
  id: string; // 코드가 부여 (r1, r2, …)
  raw: string; // 원문 그대로(요약·정규화 금지)
  type: ReqType;
  verify_type: VerifyType;
  confidence: number; // 0.0 ~ 1.0
  basis: Basis;
  basis_note: string; // 왜 그 basis/type인지 한 줄
  category: Category;
  atoms: Atom[];
}

export interface ImpliedStack {
  value: string;
  context: string;
  weight: "implied"; // 요건 승격 금지, 매칭 시 낮은 가중치 정보로만
}

export interface ConflictSide {
  text: string;
  source: string;
}
export interface Conflict {
  axis: string;
  a: ConflictSide;
  b: ConflictSide;
  resolution: "a" | "b" | "unresolved";
  rule: string;
  confidence: number;
}

export interface Excluded {
  text: string;
  reason: string;
}

/**
 * 담당업무·회사소개 — 지원자 요건은 아니지만 excluded로 버리지 않고 수집한다.
 * 매칭(스코어링)에는 쓰지 않으며, 표시·맥락·방향성 정보용이다.
 */
export interface SectionItem {
  raw: string; // 원문 그대로
  section: string; // 어느 헤더 아래인지(예: "담당 업무", "조직 소개")
}

export interface Extraction {
  company: string;
  title: string;
  job_category: string; // LLM 판정 자유문자열(하드코딩 enum 아님)
  requirements: Requirement[];
  responsibilities: SectionItem[]; // 담당업무 — 매칭 제외
  company_intro: SectionItem[]; // 회사·조직 소개 — 방향성 정보(활용 선택)
  implied_stack: ImpliedStack[];
  conflicts: Conflict[];
  excluded: Excluded[];
}

// ── OpenAI structured output (strict). nullable은 type 배열로, 모든 필드 required. ──
const str = { type: "string" } as const;
const strOrNull = { type: ["string", "null"] } as const;
const sectionItem = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["raw", "section"],
    properties: { raw: str, section: str },
  },
} as const;

export const EXTRACTION_JSON_SCHEMA = {
  name: "job_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "company",
      "title",
      "job_category",
      "requirements",
      "responsibilities",
      "company_intro",
      "implied_stack",
      "conflicts",
      "excluded",
    ],
    properties: {
      company: str,
      title: str,
      job_category: str,
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "raw",
            "type",
            "verify_type",
            "confidence",
            "basis",
            "basis_note",
            "category",
            "atoms",
          ],
          properties: {
            raw: str,
            type: { type: "string", enum: ["must", "nice", "unknown"] },
            verify_type: { type: "string", enum: ["verifiable", "judgment"] },
            confidence: { type: "number" },
            basis: {
              type: "string",
              enum: [
                "explicit_header",
                "explicit_phrase",
                "block_boundary",
                "phrasing_pattern",
                "none",
              ],
            },
            basis_note: str,
            category: {
              type: "string",
              enum: [
                "skill",
                "experience",
                "domain",
                "soft",
                "education",
                "other",
              ],
            },
            atoms: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "text", "scope", "years", "op"],
                properties: {
                  kind: {
                    type: "string",
                    enum: [
                      "skill",
                      "role",
                      "domain",
                      "years",
                      "credential",
                      "trait",
                      "activity",
                    ],
                  },
                  text: str,
                  scope: strOrNull,
                  years: { type: ["number", "null"] },
                  op: strOrNull,
                },
              },
            },
          },
        },
      },
      responsibilities: sectionItem,
      company_intro: sectionItem,
      implied_stack: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["value", "context", "weight"],
          properties: {
            value: str,
            context: str,
            weight: { type: "string", enum: ["implied"] },
          },
        },
      },
      conflicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["axis", "a", "b", "resolution", "rule", "confidence"],
          properties: {
            axis: str,
            a: {
              type: "object",
              additionalProperties: false,
              required: ["text", "source"],
              properties: { text: str, source: str },
            },
            b: {
              type: "object",
              additionalProperties: false,
              required: ["text", "source"],
              properties: { text: str, source: str },
            },
            resolution: { type: "string", enum: ["a", "b", "unresolved"] },
            rule: str,
            confidence: { type: "number" },
          },
        },
      },
      excluded: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "reason"],
          properties: { text: str, reason: str },
        },
      },
    },
  },
} as const;
