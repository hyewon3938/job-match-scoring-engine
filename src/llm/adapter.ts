/**
 * LLM 어댑터 — 유일한 provider 경계. callLLM(prompt) -> str.
 * 런타임 provider = OpenAI(제공된 키). 다른 provider로 바꾸려면 이 파일만 교체한다.
 * (Claude Code는 개발 도구일 뿐 런타임 provider가 아니다.)
 *
 * 프롬프트 해시로 cache/ 를 먼저 조회 → 반복 호출의 비용·시간 절약.
 */
import OpenAI from "openai";
import { cacheKey, readCache, writeCache } from "./cache";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export interface CallOptions {
  system?: string;
  model?: string;
  /** OpenAI structured output(JSON schema)을 강제할 때. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY가 없습니다. .env에 제공된 OpenAI 키를 넣어주세요(public 레포이므로 커밋 금지).",
    );
  }
  return (client ??= new OpenAI());
}

/** 단일 인터페이스: 프롬프트 → 문자열 응답. temperature 0. 캐시 우선. */
export async function callLLM(
  prompt: string,
  opts: CallOptions = {},
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const key = cacheKey([
    model,
    opts.system ?? "",
    opts.jsonSchema ? JSON.stringify(opts.jsonSchema) : "",
    prompt,
  ]);
  const cached = readCache(key);
  if (cached !== null) return cached;

  const res = await getClient().chat.completions.create({
    model,
    temperature: 0,
    messages: [
      ...(opts.system
        ? [{ role: "system" as const, content: opts.system }]
        : []),
      { role: "user" as const, content: prompt },
    ],
    ...(opts.jsonSchema && {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.jsonSchema.name,
          schema: opts.jsonSchema.schema,
          strict: true,
        },
      },
    }),
  });

  const out = res.choices[0]?.message?.content ?? "";
  writeCache(key, prompt, out);
  return out;
}
