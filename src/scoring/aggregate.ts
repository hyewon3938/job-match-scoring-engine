import type { Requirement } from "../extraction/schema";
import type { Judgement } from "../matching/judge";

/** 요건 + 판정 = 표시용 한 줄. */
export interface ScoredRequirement {
  raw: string;
  type: string;
  met: boolean;
  evidence: string;
}

export interface Score {
  score: number; // 0~100
  mustMet: number;
  mustTotal: number;
  niceMet: number;
  niceTotal: number;
  details: ScoredRequirement[];
}

// STEP2 임시 가중(B는 STEP5에서 실제 점수 보고 확정). 캡·게이팅 없음.
const W_MUST = 0.7;
const W_NICE = 0.3;

/**
 * §2 코드 경계: 결정론적 집계. LLM이 낸 met/근거를 받아 비율로 점수를 낸다.
 * unknown 요건은 STEP2에서 점수 계산에서 제외(표시는 유지). 캡은 STEP5.
 */
export function aggregate(
  requirements: Requirement[],
  judgements: Judgement[],
): Score {
  const byIndex = new Map(judgements.map((j) => [j.index, j]));
  const details: ScoredRequirement[] = requirements.map((r, i) => {
    const j = byIndex.get(i + 1);
    return {
      raw: r.raw,
      type: r.type,
      met: j?.met ?? false,
      evidence: j?.evidence ?? "판정 없음",
    };
  });

  const must = details.filter((d) => d.type === "must");
  const nice = details.filter((d) => d.type === "nice");
  const mustMet = must.filter((d) => d.met).length;
  const niceMet = nice.filter((d) => d.met).length;
  const mustRatio = must.length ? mustMet / must.length : 1;
  const niceRatio = nice.length ? niceMet / nice.length : 0;
  const score = Math.round((mustRatio * W_MUST + niceRatio * W_NICE) * 100);

  return {
    score,
    mustMet,
    mustTotal: must.length,
    niceMet,
    niceTotal: nice.length,
    details,
  };
}
