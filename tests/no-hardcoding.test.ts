/**
 * ① 하드코딩 부재 — 명세 요건 5(직군 무관 일반화)를 실행 가능한 계약으로 만든다.
 *
 * 왜 이 케이스를 골랐나: 일반화는 문장으로 주장할 수 있지만 테스트로만 증명된다. 홀드아웃(스포카 PM)이
 * 코드 수정 0줄로 작동해 이미 실증했고, 이 테스트는 그 성질을 회귀로부터 지킨다 — 누가 매칭 로직에
 * `if (skill === "Kotlin")` 같은 도메인 사전을 박는 순간 CI가 잡는다. verify_type·strength·캡이
 * 도메인을 불투명 문자열로만 다루는 한 src/ 로직에는 특정 스킬·직군 문자열이 없어야 한다.
 * (판정 예시가 담긴 프롬프트는 prompts/로 분리했다 — LLM 지시문은 코드가 쥔 사전이 아니다.)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 특정 스킬·직군을 가리키는 도메인 문자열(대소문자 무시).
// react/sql처럼 라이브러리로도 흔한 토큰은 단어 경계 + import 라인 제외로 오탐을 막는다.
const DOMAIN =
  /kotlin|\bspring\b|\breact\b|python|\bsql\b|kafka|redis|nginx|jira|confluence|마케팅|디자이너|개발자|퍼포먼스\s*마케터|프론트엔드|백엔드/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("① 하드코딩 부재 (명세 요건 5)", () => {
  it("src/ 로직에 특정 스킬·직군 문자열이 없다", () => {
    const hits: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.trim().startsWith("import")) return; // 라이브러리 import(react 등) 제외
          const m = line.match(DOMAIN);
          if (m) {
            hits.push(
              `${file.replace(process.cwd() + "/", "")}:${i + 1}  "${m[0]}"`,
            );
          }
        });
    }
    expect(hits, `도메인 문자열 발견:\n${hits.join("\n")}`).toEqual([]);
  });
});
