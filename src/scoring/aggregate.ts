import type { Requirement } from "../extraction/schema";
import type { Judgement, Strength } from "../matching/judge";

// 충족 강도 → 점수 가중치.
const SV: Record<Strength, number> = {
  direct: 1,
  partial: 0.5,
  related: 0,
  none: 0,
};

export interface ScoredRequirement {
  raw: string;
  type: string;
  verify_type: string;
  confidence: number;
  strength: Strength;
  evidence: string;
}

export interface Score {
  score: number;
  cap: number | null;
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

const W_MUST = 0.7;
const W_NICE = 0.3;
const CONF_GATE = 0.8;
const CAP_1 = 59;
const CAP_2 = 39;

/**
 * §5 스코어러 — 순수 함수. strength 3.5단계 기반.
 * - 점수: 모든 요건 strength 값(direct 1 / partial 0.5 / related·none 0)으로 가중.
 * - 캡: verifiable 필수는 direct일 때만 "충족". partial/related/none은 미충족 → 캡 대상(confidence≥0.8).
 *   (필수 스킬을 반만 갖춘 건 못 갖춘 것 — 캡은 확실할 때만 안 건다.)
 * - judgment·우대: strength 그대로 점수 가중, 캡 아님. 중복 허용(하나의 경험이 여러 요건 direct 가능).
 */
export function aggregate(
  requirements: Requirement[],
  judgements: Judgement[],
): Score {
  const byIndex = new Map(judgements.map((j) => [j.index, j]));
  const strOf = (i: number): Strength => byIndex.get(i + 1)?.strength ?? "none";

  const details: ScoredRequirement[] = requirements.map((r, i) => ({
    raw: r.raw,
    type: r.type,
    verify_type: r.verify_type,
    confidence: r.confidence,
    strength: strOf(i),
    evidence: byIndex.get(i + 1)?.evidence ?? "근거 없음",
  }));

  const must = requirements
    .map((r, i) => ({ r, s: strOf(i) }))
    .filter((x) => x.r.type === "must");
  const nice = requirements
    .map((r, i) => ({ r, s: strOf(i) }))
    .filter((x) => x.r.type === "nice");
  const vMust = must.filter((x) => x.r.verify_type === "verifiable");
  const jMust = must.filter((x) => x.r.verify_type === "judgment");

  // "충족"(direct) 카운트 — 표시용.
  const vMustMet = vMust.filter((x) => x.s === "direct").length;
  const jMustMet = jMust.filter((x) => x.s === "direct").length;
  const niceMet = nice.filter((x) => x.s === "direct").length;

  // 점수: strength 값 가중.
  const sum = (arr: { s: Strength }[]) => arr.reduce((a, x) => a + SV[x.s], 0);
  const mustScore = must.length ? sum(must) / must.length : 1;
  const niceScore = nice.length ? sum(nice) / nice.length : 0;
  const scoreRaw = Math.round((mustScore * W_MUST + niceScore * W_NICE) * 100);

  // 캡: verifiable 필수가 direct가 아닌 것(미충족) 중 confidence≥게이트.
  const vMissGated = vMust.filter(
    (x) => x.s !== "direct" && x.r.confidence >= CONF_GATE,
  );
  let cap: number | null = null;
  let capReason: string;
  if (vMissGated.length >= 2) {
    cap = CAP_2;
    capReason = `verifiable 필수 ${vMissGated.length}개 미충족 → 천장 ${CAP_2}`;
  } else if (vMissGated.length === 1) {
    cap = CAP_1;
    capReason = `verifiable 필수 1개 미충족("${vMissGated[0].r.raw.slice(0, 18)}…") → 천장 ${CAP_1}`;
  } else {
    capReason = "verifiable 필수 전부 충족(direct) → 캡 미적용";
  }

  const score = cap !== null ? Math.min(scoreRaw, cap) : scoreRaw;

  const jWeak = jMust
    .filter((x) => x.s !== "direct")
    .map((x) => x.r.raw.slice(0, 10));
  const summary =
    `verifiable ${vMustMet}/${vMust.length} · judgment ${jMustMet}/${jMust.length}` +
    (jWeak.length ? `(${jWeak.join("·")} 약함)` : "") +
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
