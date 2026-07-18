import type { Extraction } from "./schema";

/**
 * 원칙 ①(추출과 분류 분리)의 게이팅 레이어.
 * LLM이 요약/환각으로 "원문에 없는 문장"을 만들지 않았는지 통계적으로 검증한다.
 *
 * 각 requirement.text 와 experience.raw 가 본문의 (공백 정규화) 부분 문자열인지 확인.
 * 부분 문자열이 아니면 → 원문 대조 실패 플래그(추출이 아니라 창작).
 *
 * 완벽한 검증은 아니다(공백만 무시). 하지만 "뽑기+판단을 동시에 시키면 원문에 없는 걸
 * 요약한다"는 위험을 값싸게 잡아내는 eval 게이트다.
 */

export type VerifyFlag = {
  kind: "requirement-not-verbatim" | "experience-raw-not-verbatim";
  text: string;
};

const stripWs = (s: string) => s.replace(/\s+/g, "");

export function verifyExtraction(
  bodyText: string,
  extraction: Extraction,
): VerifyFlag[] {
  const haystack = stripWs(bodyText);
  const flags: VerifyFlag[] = [];

  for (const r of extraction.requirements) {
    if (!haystack.includes(stripWs(r.text))) {
      flags.push({ kind: "requirement-not-verbatim", text: r.text });
    }
  }

  if (
    extraction.experience &&
    !haystack.includes(stripWs(extraction.experience.raw))
  ) {
    flags.push({
      kind: "experience-raw-not-verbatim",
      text: extraction.experience.raw,
    });
  }

  return flags;
}
