/**
 * ② 랭킹 순서 불변식 — 스코어러 전체의 계약.
 *
 * 왜 이 케이스를 골랐나: 정성 매칭에 "정답 점수"는 없다. 94가 옳은지 아무도 모르고 프롬프트 한 글자에
 * 흔들린다. 하지만 "정답 순서"는 있다 — 완벽형은 미스매칭보다 위여야 하고, verifiable 필수 미충족으로
 * 캡이 걸린 지원자는 캡 없는 지원자보다 아래여야 한다. 그래서 score==94 같은 절대값이 아니라 순서
 * 불변식만 단언한다. 개발직·PM 두 데이터셋에 같은 불변식을 걸어 직군 무관성(요건 5)도 함께 검증한다.
 *
 * 픽스처(result/*.json)는 LLM 응답까지 반영된 실제 파이프라인 산출물이다 — 비결정성을 경계 밖으로
 * 밀어내고(캐시된 결과), 결정론적 순서만 여기서 단언한다.
 */
import { describe, expect, it } from "vitest";
import naver from "../result/54352607-naver-webtoon-disney-server.json";
import spoqa from "../result/54335440-spoqa-pm-junior.json";

type Result = {
  ranked: { name: string; score: number; cap: number | null }[];
};

const rankOf = (r: Result, keyword: string) =>
  r.ranked.findIndex((x) => x.name.includes(keyword));

const datasets: [string, Result][] = [
  ["개발직", naver as Result],
  ["PM(홀드아웃)", spoqa as Result],
];

for (const [label, r] of datasets) {
  describe(`② 랭킹 불변식 — ${label}`, () => {
    it("점수 내림차순으로 정렬돼 있다", () => {
      const scores = r.ranked.map((x) => x.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it("완벽형이 미스매칭형보다 위", () => {
      expect(rankOf(r, "perfect")).toBeLessThan(rankOf(r, "mismatch"));
    });

    it("캡 걸린 지원자가 캡 없는 지원자보다 전부 아래", () => {
      const cappedRanks = r.ranked
        .map((x, i) => ({ i, capped: x.cap !== null }))
        .filter((x) => x.capped)
        .map((x) => x.i);
      const uncappedRanks = r.ranked
        .map((x, i) => ({ i, capped: x.cap !== null }))
        .filter((x) => !x.capped)
        .map((x) => x.i);
      expect(Math.max(...uncappedRanks)).toBeLessThan(Math.min(...cappedRanks));
    });
  });
}
