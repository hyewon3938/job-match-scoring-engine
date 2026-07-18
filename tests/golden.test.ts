/**
 * ④ 골든 픽스처 — 왜 이 케이스를 골랐나.
 *
 * ② 랭킹 불변식은 실제 파이프라인 전체 경로(HTTP·adapter 포함)를 실측한다.
 * ④ 골든은 LLM만 mock으로 고정해 'LLM 뒤 파이프라인이 결정론'임을 스냅샷으로 회귀 감지한다.
 * 두 테스트는 자르는 경계가 달라 서로 보완한다 — 테스트가 네트워크·API 키·과금에 의존하면 테스트가 아니다.
 *
 * 스냅샷엔 [점수 + 캡여부 + 각 요건 strength + 근거 조립]을 통째로 담는다.
 * 집계·가중·캡·strength매핑이 함께 안 깨지는지 한 방에 보는 게 골든의 목적이다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import golden from "./fixtures/golden-llm-responses.json";

// LLM 경계만 mock — 그 뒤(추출 파싱·집계·캡·근거 조립)는 실제 코드가 돈다.
vi.mock("../src/llm/adapter", () => ({ callLLM: vi.fn() }));

import { callLLM } from "../src/llm/adapter";
import { extractBodyText } from "../src/crawler";
import { extract } from "../src/extraction/extract";
import { judge } from "../src/matching/judge";
import { aggregate } from "../src/scoring/aggregate";

const mockLLM = vi.mocked(callLLM);

describe("④ 골든 픽스처 (LLM 경계 mock → 파이프라인 결정론)", () => {
  it("고정 응답 → 추출 파싱·집계·캡·근거 조립까지 스냅샷 일치", async () => {
    mockLLM.mockReset();
    mockLLM.mockResolvedValueOnce(golden.extract); // extract 1콜
    const html = readFileSync(
      join(
        process.cwd(),
        "fixtures/postings/54352607-naver-webtoon-disney-server/view-detail.html",
      ),
      "utf8",
    );
    const extraction = await extract(extractBodyText(html));

    const results = [];
    for (const j of golden.judges) {
      mockLLM.mockResolvedValueOnce(j.response); // judge 1콜 / 이력서
      const judgements = await judge(extraction.requirements, j.resume);
      const s = aggregate(extraction.requirements, judgements);
      results.push({
        name: j.name,
        score: s.score,
        cap: s.cap,
        capReason: s.capReason,
        summary: s.summary,
        details: s.details, // 요건별 strength + evidence(근거 조립)
      });
    }
    results.sort((a, b) => b.score - a.score);

    expect(results).toMatchSnapshot();
  });
});
