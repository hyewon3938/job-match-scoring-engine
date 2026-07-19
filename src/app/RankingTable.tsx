"use client";
import { useEffect, useState } from "react";

export type Detail = {
  raw: string;
  type: string;
  verify_type: string;
  strength: string;
  evidence: string;
};
export type RankedItem = {
  name: string;
  score: number;
  cap: number | null;
  capReason: string;
  summary: string;
  vMustMet: number;
  vMustTotal: number;
  jMustMet: number;
  jMustTotal: number;
  niceMet: number;
  niceTotal: number;
  details: Detail[];
  resumeText: string;
};

// 목업 이력서 파일명 → 사람이 읽는 유형 라벨 (도메인 무관, 이력서 설계 유형)
function label(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("perfect"))
    return n.includes("-a") ? "완벽 매칭 A" : "완벽 매칭 B";
  if (n.includes("mismatch")) return "미스매칭";
  if (n.includes("attitude")) return "부분 매칭 · 태도 미충족";
  if (n.includes("verifiable")) return "부분 매칭 · 필수 미충족";
  if (n.includes("-exp")) return "부분 매칭 · 경력 미충족";
  if (n.includes("judgment")) return "부분 매칭 · 정성 약함";
  if (n.includes("must-full")) return "부분 매칭 · 우대만 약함";
  return "부분 매칭";
}

function VTag({ v }: { v: string }) {
  const isV = v === "verifiable";
  return (
    <span
      className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isV ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
      }`}
    >
      {isV ? "검증가능" : "정성판단"}
    </span>
  );
}

// 충족 강도 — 배경 뱃지, 너비 고정으로 오른쪽 정렬을 맞춘다.
const STRENGTH: Record<string, { ch: string; cls: string; label: string }> = {
  direct: {
    ch: "✓",
    cls: "bg-emerald-100 text-emerald-700",
    label: "직접 충족",
  },
  partial: { ch: "◐", cls: "bg-amber-100 text-amber-700", label: "부분 충족" },
  related: { ch: "△", cls: "bg-neutral-200 text-neutral-500", label: "관련만" },
  none: { ch: "·", cls: "bg-neutral-100 text-neutral-400", label: "없음" },
};

function SBadge({ s }: { s: string }) {
  const m = STRENGTH[s] ?? STRENGTH.none;
  return (
    <span
      className={`inline-flex w-20 shrink-0 items-center justify-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold ${m.cls}`}
    >
      <span>{m.ch}</span>
      <span>{m.label}</span>
    </span>
  );
}

function CapStatus({ r }: { r: RankedItem }) {
  if (r.cap === null) {
    return (
      <span className="text-xs font-medium text-emerald-600">
        필수 충족 · 상한 없음
      </span>
    );
  }
  const miss = r.vMustTotal - r.vMustMet;
  return (
    <span className="text-xs font-medium text-red-600">
      검증가능 필수 {miss}개 미충족 · 상한 {r.cap}점
    </span>
  );
}

export default function RankingTable({ ranked }: { ranked: RankedItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // 개발 서버 리로드로 상태가 초기화돼도 열린 행을 복원한다.
  // localStorage는 서버 렌더 시점에 없어 초기값으로 쓰면 hydration이 어긋나므로,
  // 마운트 후 한 번 복원한다(의도된 패턴 — lint 예외는 eslint.config.mjs에 사유와 함께).
  useEffect(() => {
    const saved = localStorage.getItem("openRow");
    if (saved) setOpen(saved);
  }, []);
  const toggle = (name: string) => {
    const next = open === name ? null : name;
    setOpen(next);
    localStorage.setItem("openRow", next ?? "");
  };
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-neutral-200 text-left text-xs text-neutral-400">
          <th className="w-10 py-2 pr-2">#</th>
          <th className="w-44 py-2 pr-2">지원자</th>
          <th className="w-16 py-2 pr-2">점수</th>
          <th className="w-28 py-2 pr-2">검증가능 필수</th>
          <th className="w-28 py-2 pr-2">정성판단 필수</th>
          <th className="w-14 py-2 pr-2">우대</th>
          <th className="py-2 pr-2">캡 상태</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r, i) => (
          <Row
            key={r.name}
            r={r}
            rank={i + 1}
            open={open === r.name}
            onToggle={() => toggle(r.name)}
          />
        ))}
      </tbody>
    </table>
  );
}

function ReqList({ items }: { items: Detail[] }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((d, j) => {
        const met = d.strength === "direct";
        return (
          <li key={j} className="flex items-start gap-2">
            <SBadge s={d.strength} />
            <VTag v={d.verify_type} />
            <span className="flex-1">
              <span
                className={
                  met ? "font-medium text-neutral-900" : "text-neutral-500"
                }
              >
                {d.raw}
              </span>
              {d.strength !== "none" && (
                <span className="mt-0.5 block text-[11px] italic text-neutral-400">
                  근거: {d.evidence}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Row({
  r,
  rank,
  open,
  onToggle,
}: {
  r: RankedItem;
  rank: number;
  open: boolean;
  onToggle: () => void;
}) {
  const musts = r.details.filter((d) => d.type === "must");
  const nices = r.details.filter((d) => d.type === "nice");
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
      >
        <td className="py-3 pr-2 text-neutral-400">{rank}</td>
        <td className="py-3 pr-2 font-medium">{label(r.name)}</td>
        <td className="py-3 pr-2 text-lg font-bold">{r.score}</td>
        <td className="py-3 pr-2">
          <b>{r.vMustMet}</b>/{r.vMustTotal}
        </td>
        <td className="py-3 pr-2">
          <b>{r.jMustMet}</b>/{r.jMustTotal}
        </td>
        <td className="py-3 pr-2 text-neutral-600">
          {r.niceMet}/{r.niceTotal}
        </td>
        <td className="py-3 pr-2">
          <CapStatus r={r} />
        </td>
      </tr>
      {open && (
        <tr>
          <td
            colSpan={7}
            className="border-b border-neutral-100 bg-neutral-50 px-4 py-4"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
              <div className="min-w-0 flex-1">
                <div className="mb-2 text-xs font-semibold text-neutral-500">
                  필수 요건
                </div>
                <ReqList items={musts} />
                <div className="mb-2 text-xs font-semibold text-neutral-500">
                  우대 요건 (직접 충족 {r.niceMet}/{r.niceTotal})
                </div>
                <ReqList items={nices} />
              </div>
              <div className="flex min-h-0 flex-col lg:w-96 lg:shrink-0">
                <div className="mb-2 text-xs font-semibold text-neutral-500">
                  이력서 원문 (근거 출처)
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 text-xs leading-relaxed">
                  {r.resumeText}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
