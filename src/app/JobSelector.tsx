"use client";
import { useEffect, useState } from "react";
import RankingTable, { type RankedItem } from "./RankingTable";

export type JobResult = {
  slug: string;
  job: {
    company: string;
    title: string;
    jobCategory: string;
    requirements: { raw: string; type: string; verify_type: string }[];
  };
  ranked: RankedItem[];
};

export default function JobSelector({ jobs }: { jobs: JobResult[] }) {
  const [idx, setIdx] = useState(0);
  // 개발 서버 리로드로 초기화돼도 보던 공고를 복원한다.
  useEffect(() => {
    const saved = Number(localStorage.getItem("jobIdx"));
    if (saved >= 0 && saved < jobs.length) setIdx(saved);
  }, [jobs.length]);
  const select = (i: number) => {
    setIdx(i);
    localStorage.setItem("jobIdx", String(i));
  };
  const j = jobs[idx];
  const must = j.job.requirements.filter((r) => r.type === "must");
  const vN = must.filter((r) => r.verify_type === "verifiable").length;
  const jN = must.filter((r) => r.verify_type === "judgment").length;

  return (
    <>
      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {jobs.map((jb, i) => (
          <button
            key={jb.slug}
            onClick={() => select(i)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              i === idx
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {jb.job.company}
            <span className="ml-1.5 text-[10px] text-neutral-400">
              {i === 0 ? "개발직" : "비개발직"}
            </span>
          </button>
        ))}
      </div>

      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-neutral-400">
          {j.job.jobCategory}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{j.job.company}</h1>
        <p className="text-neutral-600">{j.job.title}</p>
        <p className="mt-3 text-xs text-neutral-500">
          필수 {must.length}개 ·{" "}
          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">
            검증가능 {vN}
          </span>{" "}
          <span className="rounded bg-purple-100 px-1.5 py-0.5 font-medium text-purple-700">
            정성판단 {jN}
          </span>{" "}
          · 지원자 {j.ranked.length}명
        </p>
      </header>

      <RankingTable ranked={j.ranked} />

      <p className="mt-6 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-400">
        캡(상한)은 <b className="text-blue-600">검증가능(verifiable)</b> 필수
        미충족에만 적용됩니다. 태도·컬처핏 같은{" "}
        <b className="text-purple-600">정성판단(judgment)</b>은 판정이 흔들릴 수
        있어 비가역 캡이 아니라 점수 감점으로만 반영합니다.
      </p>
    </>
  );
}
