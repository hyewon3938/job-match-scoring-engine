import { readFileSync } from "node:fs";
import { join } from "node:path";
import RankingTable, { type RankedItem } from "./RankingTable";

// result.json을 매 요청 다시 읽어 최신 판정을 반영(개발 중 갱신).
export const dynamic = "force-dynamic";

type Result = {
  job: {
    company: string;
    title: string;
    jobCategory: string;
    requirements: { raw: string; type: string; verify_type: string }[];
  };
  ranked: RankedItem[];
};

export default function Home() {
  const result: Result = JSON.parse(
    readFileSync(join(process.cwd(), "result.json"), "utf8"),
  );
  const must = result.job.requirements.filter((r) => r.type === "must");
  const vN = must.filter((r) => r.verify_type === "verifiable").length;
  const jN = must.filter((r) => r.verify_type === "judgment").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 font-sans text-neutral-900">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-neutral-400">
          {result.job.jobCategory}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{result.job.company}</h1>
        <p className="text-neutral-600">{result.job.title}</p>
        <p className="mt-3 text-xs text-neutral-500">
          필수 {must.length}개 —{" "}
          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">
            검증가능 {vN}
          </span>{" "}
          <span className="rounded bg-purple-100 px-1.5 py-0.5 font-medium text-purple-700">
            정성판단 {jN}
          </span>{" "}
          · 지원자 {result.ranked.length}명
        </p>
      </header>

      <RankingTable ranked={result.ranked} />

      <p className="mt-6 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-400">
        캡(상한)은 <b className="text-blue-600">검증가능(verifiable)</b> 필수
        미충족에만 적용됩니다. 태도·컬처핏 같은{" "}
        <b className="text-purple-600">정성판단(judgment)</b>은 judge 판정이
        흔들릴 수 있어 비가역 캡이 아니라 점수 감점으로만 반영합니다.
      </p>
    </main>
  );
}
