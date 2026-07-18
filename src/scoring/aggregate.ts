import type { Requirement } from "../extraction/schema";
import type { Judgement } from "../matching/judge";

export interface ScoredRequirement {
  raw: string;
  type: string;
  verify_type: string;
  confidence: number;
  met: boolean;
  evidence: string;
}

export interface Score {
  score: number;
  cap: number | null; // 적용된 천장(null=미적용)
  capReason: string;
  vMustMet: number;
  vMustTotal: number;
  jMustMet: number;
  jMustTotal: number;
  niceMet: number;
  niceTotal: number;
  details: ScoredRequirement[];
  summary: string;
}

// STEP5 파라미터(기본값 — "왜 이 값인지"는 README에 서술).
const W_MUST = 0.7;
const W_NICE = 0.3;
const CONF_GATE = 0.8; // 캡은 이 이상 confidence(basis)에서만 — 불확실한 분류로 비가역 캡 걸지 않음
const CAP_1 = 59; // verifiable 필수 1개 미충족
const CAP_2 = 39; // verifiable 필수 2개 이상 미충족

/**
 * §5 스코어러 — 순수 함수(LLM 호출 없음. 여기서 결정론·테스트 가능).
 * - 캡: verifiable 필수 미충족에만, confidence≥0.8일 때. judgment 미충족은 캡 아님(감점).
 * - judgment 미충족은 must 충족 비율에 반영돼 자동 감점된다(점수만 내려감).
 * - unknown은 가점으로만(없어도 페널티 없음): must/nice 계산에서 제외.
 */
export function aggregate(
  requirements: Requirement[],
  judgements: Judgement[],
): Score {
  const byIndex = new Map(judgements.map((j) => [j.index, j]));
  const met = (i: number) => byIndex.get(i + 1)?.met ?? false;

  const details: ScoredRequirement[] = requirements.map((r, i) => ({
    raw: r.raw,
    type: r.type,
    verify_type: r.verify_type,
    confidence: r.confidence,
    met: met(i),
    evidence: byIndex.get(i + 1)?.evidence ?? "판정 없음",
  }));

  const must = requirements
    .map((r, i) => ({ r, met: met(i) }))
    .filter((x) => x.r.type === "must");
  const nice = requirements
    .map((r, i) => ({ r, met: met(i) }))
    .filter((x) => x.r.type === "nice");
  const vMust = must.filter((x) => x.r.verify_type === "verifiable");
  const jMust = must.filter((x) => x.r.verify_type === "judgment");

  const vMustMet = vMust.filter((x) => x.met).length;
  const jMustMet = jMust.filter((x) => x.met).length;
  const niceMet = nice.filter((x) => x.met).length;

  // 기본 점수: must 충족 비율(verifiable+judgment 모두) × 70 + nice 비율 × 30.
  // judgment 미충족은 이 비율을 낮춰 자동 감점된다(캡은 아님).
  const mustRatio = must.length
    ? must.filter((x) => x.met).length / must.length
    : 1;
  const niceRatio = nice.length ? niceMet / nice.length : 0;
  const scoreRaw = Math.round((mustRatio * W_MUST + niceRatio * W_NICE) * 100);

  // 캡: verifiable 필수 미충족 중 confidence≥게이트인 것만.
  const vMissGated = vMust.filter((x) => !x.met && x.r.confidence >= CONF_GATE);
  let cap: number | null = null;
  let capReason: string;
  if (vMissGated.length >= 2) {
    cap = CAP_2;
    capReason = `verifiable 필수 ${vMissGated.length}개 미충족 → 천장 ${CAP_2}`;
  } else if (vMissGated.length === 1) {
    cap = CAP_1;
    capReason = `verifiable 필수 1개 미충족("${vMissGated[0].r.raw.slice(0, 18)}…") → 천장 ${CAP_1}`;
  } else {
    capReason = "verifiable 필수 전부 충족 → 캡 미적용";
  }

  const score = cap !== null ? Math.min(scoreRaw, cap) : scoreRaw;

  const jMiss = jMust.filter((x) => !x.met).map((x) => x.r.raw.slice(0, 10));
  const summary =
    `verifiable 필수 ${vMustMet}/${vMust.length}, judgment ${jMustMet}/${jMust.length}` +
    (jMiss.length ? `(${jMiss.join("·")} 미확인)` : "") +
    `. ${cap !== null ? `캡 ${cap} 적용` : "캡 미적용"}.`;

  return {
    score,
    cap,
    capReason,
    vMustMet,
    vMustTotal: vMust.length,
    jMustMet,
    jMustTotal: jMust.length,
    niceMet,
    niceTotal: nice.length,
    details,
    summary,
  };
}
