import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import JobSelector, { type JobResult } from "./JobSelector";

// result/ 는 레포에 커밋된 산출물이라 빌드 시점에 읽어 정적 생성한다(배포에서도 파일 접근 보장).
// 개발 서버에서는 매 요청 다시 렌더되므로 재실행한 결과도 바로 반영된다.
export const dynamic = "force-static";

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
