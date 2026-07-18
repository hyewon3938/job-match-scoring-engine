/**
 * ③ 캡 단위테스트 — 순수 함수 aggregate에 판정값을 직접 주입한다. LLM·이력서·네트워크 안 거침.
 *
 * 왜 이 케이스를 골랐나: README에 쓴 핵심 결정이 코드에 실재하는지 결정론으로 증명한다.
 * "캡은 verifiable 필수 미충족에만, judgment 미충족은 감점, confidence<0.8이면 캡 게이팅 제외" —
 * 이 규칙은 랭킹 밴드를 가르는 비가역 판정이라 가장 조용히 깨지기 쉽다.
 * 특히 감점 케이스(verifiable 3/3 + judgment 미충족 → 캡 아님)는 이력서 픽스처로 두지 않고 여기서
 * 판정값을 직접 주입해 검증한다 — 픽스처는 랭킹 불변식(②)에, 결정론은 단위테스트(③)에 층을 나눴다.
 */
import { describe, expect, it } from "vitest";
import type { Requirement } from "../src/extraction/schema";
import type { Judgement, Strength } from "../src/matching/judge";
import { aggregate } from "../src/scoring/aggregate";

// 캡 축 테스트용 최소 요건: verifiable 필수 3 + judgment 필수 1 (전부 explicit_header → confidence 0.95).
const req = (
  i: number,
  verify_type: "verifiable" | "judgment",
): Requirement => ({
  id: `r${i}`,
  raw: `요건${i}`,
  type: "must",
  verify_type,
  confidence: 0.95,
  basis: "explicit_header",
  basis_note: "",
  category: "skill",
  atoms: [],
});
const jg = (index: number, strength: Strength): Judgement => ({
  index,
  strength,
  evidence: "",
});

const REQS = [
  req(1, "verifiable"),
  req(2, "verifiable"),
  req(3, "verifiable"),
  req(4, "judgment"),
];

describe("③ 캡 규칙 (순수 함수)", () => {
  it("verifiable 1개 미충족 → 캡 59", () => {
    const s = aggregate(REQS, [
      jg(1, "direct"),
      jg(2, "direct"),
      jg(3, "none"),
      jg(4, "direct"),
    ]);
    expect(s.cap).toBe(59);
    expect(s.score).toBeLessThanOrEqual(59);
  });

  it("verifiable 2개 미충족 → 캡 39", () => {
    const s = aggregate(REQS, [
      jg(1, "direct"),
      jg(2, "none"),
      jg(3, "related"),
      jg(4, "direct"),
    ]);
    expect(s.cap).toBe(39);
  });

  it("verifiable partial도 '미충족'으로 캡 (반만 갖춘 건 못 갖춘 것)", () => {
    const s = aggregate(REQS, [
      jg(1, "direct"),
      jg(2, "direct"),
      jg(3, "partial"),
      jg(4, "direct"),
    ]);
    expect(s.cap).toBe(59);
  });

  it("verifiable 3/3 direct + judgment 미충족 → 캡 아님, 감점만", () => {
    const full = aggregate(REQS, [
      jg(1, "direct"),
      jg(2, "direct"),
      jg(3, "direct"),
      jg(4, "direct"),
    ]);
    const jMiss = aggregate(REQS, [
      jg(1, "direct"),
      jg(2, "direct"),
      jg(3, "direct"),
      jg(4, "none"),
    ]);
    expect(jMiss.cap).toBeNull(); // judgment는 비가역 캡을 걸지 않는다
    expect(jMiss.score).toBeLessThan(full.score); // 대신 점수로 감점
  });

  it("confidence<0.8인 verifiable 미충족은 캡 게이팅에서 제외(감점으로 강등)", () => {
    const lowConf: Requirement[] = [
      { ...req(1, "verifiable"), confidence: 0.5, basis: "phrasing_pattern" },
      req(2, "verifiable"),
      req(3, "verifiable"),
      req(4, "judgment"),
    ];
    const s = aggregate(lowConf, [
      jg(1, "none"),
      jg(2, "direct"),
      jg(3, "direct"),
      jg(4, "direct"),
    ]);
    expect(s.cap).toBeNull(); // 확신이 낮은 필수 분류엔 비가역 캡을 걸지 않는다
  });
});
