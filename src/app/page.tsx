import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import JobSelector, { type JobResult } from "./JobSelector";

// result/ 를 매 요청 다시 읽어 최신 판정을 반영(개발 중 갱신).
export const dynamic = "force-dynamic";

export default function Home() {
  const dir = join(process.cwd(), "result");
  const jobs: JobResult[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a)) // 54352607(네이버 개발직)을 먼저
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 font-sans text-neutral-900">
      <JobSelector jobs={jobs} />
    </main>
  );
}
