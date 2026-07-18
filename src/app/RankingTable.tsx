"use client";
import { useState } from "react";

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
  vMustMet: number;
  vMustTotal: number;
  jMustMet: number;
  jMustTotal: number;
  niceMet: number;
  niceTotal: number;
  details: Detail[];
  resumeText: string;
};

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

const STRENGTH: Record<string, { ch: string; cls: string; label: string }> = {
  direct: { ch: "✓", cls: "text-emerald-600", label: "직접" },
  partial: { ch: "◐", cls: "text-amber-500", label: "부분" },
  related: { ch: "~", cls: "text-neutral-400", label: "관련만" },
  none: { ch: "·", cls: "text-neutral-300", label: "없음" },
};

function SIcon({ s }: { s: string }) {
  const m = STRENGTH[s] ?? STRENGTH.none;
  return (
    <span className={`w-4 shrink-0 text-center font-bold ${m.cls}`}>
      {m.ch}
    </span>
  );
}

function CapStatus({ r }: { r: RankedItem }) {
  if (r.cap === null) {
    return (
      <span className="text-xs font-medium text-emerald-600">
        ✓ 필수 충족 — 상한 없음
      </span>
    );
  }
  const miss = r.vMustTotal - r.vMustMet;
  return (
    <span className="text-xs font-medium text-red-600">
      ✗ 검증가능 필수 {miss}개 미충족 → 상한 {r.cap}점
    </span>
  );
}

export default function RankingTable({ ranked }: { ranked: RankedItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-neutral-200 text-left text-xs text-neutral-400">
          <th className="py-2 pr-2">#</th>
          <th className="py-2 pr-2">지원자</th>
          <th className="py-2 pr-2">점수</th>
          <th className="py-2 pr-2">검증가능 필수</th>
          <th className="py-2 pr-2">정성판단 필수</th>
          <th className="py-2 pr-2">우대</th>
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
            onToggle={() => setOpen(open === r.name ? null : r.name)}
          />
        ))}
      </tbody>
    </table>
  );
}

function ReqList({ items }: { items: Detail[] }) {
  return (
    <ul className="mb-4 space-y-1.5">
      {items.map((d, j) => (
        <li key={j} className="flex items-start gap-2">
          <SIcon s={d.strength} />
          <VTag v={d.verify_type} />
          <span className="flex-1">
            <span
              className={
                d.strength === "direct"
                  ? "text-neutral-800"
                  : "text-neutral-500"
              }
            >
              {d.raw}
            </span>
            <span className="ml-1 text-[10px] text-neutral-400">
              [{(STRENGTH[d.strength] ?? STRENGTH.none).label}]
            </span>
            {d.strength !== "none" && (
              <span className="ml-1 text-neutral-400">— {d.evidence}</span>
            )}
          </span>
        </li>
      ))}
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
  const [resume, setResume] = useState(false);
  const musts = r.details.filter((d) => d.type === "must");
  const nices = r.details.filter((d) => d.type === "nice");
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
      >
        <td className="py-3 pr-2 text-neutral-400">{rank}</td>
        <td className="py-3 pr-2 font-medium">{r.name}</td>
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
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              필수 요건{" "}
              <span className="font-normal text-neutral-400">
                (✓ 직접 · ◐ 부분 · ~ 관련만)
              </span>
            </div>
            <ReqList items={musts} />
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              우대 요건 (direct {r.niceMet}/{r.niceTotal})
            </div>
            <ReqList items={nices} />
            <button
              onClick={() => setResume(!resume)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {resume ? "이력서 원문 닫기" : "이력서 원문 보기 (근거 출처)"}
            </button>
            {resume && (
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 text-xs">
                {r.resumeText}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
