/**
 * 공고 URL을 받아 원본 HTML을 fixtures/postings/{slug}/ 에 저장하는 CLI.
 * 크롤러(src/crawler)를 한 번 호출할 뿐이며, 매칭 파이프라인과는 분리돼 있다.
 *
 * 사용법:
 *   pnpm tsx scripts/fetch-fixture.ts "<공고 URL>" <slug>
 * 예:
 *   pnpm tsx scripts/fetch-fixture.ts "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54259129" 54259129-inflearn-frontend
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchJobPosting, extractRecIdx } from "../src/crawler";

async function main() {
  const [url, slug] = process.argv.slice(2);
  if (!url || !slug) {
    console.error(
      '사용법: pnpm tsx scripts/fetch-fixture.ts "<공고 URL>" <slug>',
    );
    process.exit(1);
  }
  const html = await fetchJobPosting(url);
  const dir = join(process.cwd(), "fixtures", "postings", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "view-detail.html"), html);
  writeFileSync(
    join(dir, "meta.json"),
    JSON.stringify(
      {
        rec_idx: extractRecIdx(url),
        slug,
        url,
        fetchedAt: new Date().toISOString().slice(0, 10),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `저장: fixtures/postings/${slug}/view-detail.html (${html.length} chars)`,
  );
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
