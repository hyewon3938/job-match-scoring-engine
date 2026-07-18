/**
 * result/{slug}.json → docs/results/{slug}.md
 * UI가 보여주는 랭킹·요건별 판정·이력서 원문을 사람이 읽는 마크다운으로 내보낸다.
 * 실행: pnpm tsx scripts/export-md.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SL: Record<string, string> = {
  direct: "직접",
  partial: "부분",
  related: "관련만",
  none: "없음",
};
const VL: Record<string, string> = {
  verifiable: "검증가능",
  judgment: "정성판단",
};

const resultDir = join(process.cwd(), "result");
const outDir = join(process.cwd(), "docs", "results");
mkdirSync(outDir, { recursive: true });

for (const f of readdirSync(resultDir).filter((x) => x.endsWith(".json"))) {
  const r = JSON.parse(readFileSync(join(resultDir, f), "utf8"));
  const reqs = r.job.requirements as {
    raw: string;
    type: string;
    verify_type: string;
  }[];
  const must = reqs.filter((x) => x.type === "must");
  const v = must.filter((x) => x.verify_type === "verifiable").length;
  const jd = must.filter((x) => x.verify_type === "judgment").length;
  const niceN = reqs.filter((x) => x.type === "nice").length;

  let md = `# ${r.job.company} — ${r.job.title}\n\n`;
  md += `> ${r.job.jobCategory} · 필수 ${must.length}개(검증가능 ${v} / 정성판단 ${jd}) · 우대 ${niceN}개 · 지원자 ${r.ranked.length}명\n>\n`;
  md += `> 캡(상한)은 검증가능(verifiable) 필수 미충족에만 적용. 정성판단(judgment)은 점수 감점으로만 반영.\n\n`;

  r.ranked.forEach((c: any, i: number) => {
    md += `## ${i + 1}위 · ${c.name} — ${c.score}점${c.cap !== null ? ` (천장 ${c.cap})` : ""}\n\n`;
    md += `- ${c.summary}\n`;
    md += `- ${c.capReason}\n\n`;

    const musts = c.details.filter((d: any) => d.type === "must");
    const nices = c.details.filter((d: any) => d.type === "nice");

    md += `### 필수 요건\n\n`;
    for (const d of musts) {
      md += `- **[${SL[d.strength]}]** \`${VL[d.verify_type]}\` ${d.raw}\n`;
      md += `  - 근거: ${d.evidence}\n`;
    }
    md += `\n### 우대 요건 (직접 충족 ${c.niceMet}/${c.niceTotal})\n\n`;
    for (const d of nices) {
      md += `- **[${SL[d.strength]}]** ${d.raw}\n`;
      md += `  - 근거: ${d.evidence}\n`;
    }
    md += `\n<details>\n<summary>이력서 원문</summary>\n\n\`\`\`\n${c.resumeText.trimEnd()}\n\`\`\`\n\n</details>\n\n---\n\n`;
  });

  const out = join(outDir, f.replace(".json", ".md"));
  writeFileSync(out, md);
  console.log(`✓ ${out}`);
}
