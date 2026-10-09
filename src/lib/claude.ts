import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Calls Claude with a JSON-schema constrained response and returns the parsed object.
 * Uses server-side refusal fallbacks so a false-positive safety decline doesn't break the feature.
 */
export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AIError("AI 기능이 설정되지 않았습니다. 서버에 ANTHROPIC_API_KEY를 설정해 주세요.", 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AIError("요청이 많아 잠시 후 다시 시도해 주세요.", 429);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AIError(`AI 응답 중 오류가 발생했습니다. (${error.status ?? "network"})`, 502);
    }
    const c = getClient();
    if (error instanceof Anthropic.AnthropicError || (c.apiKey == null && c.authToken == null)) {
      // no credentials could be resolved (no ANTHROPIC_API_KEY / auth token / profile)
      throw new AIError("AI 기능이 설정되지 않았습니다. 서버에 ANTHROPIC_API_KEY를 설정해 주세요.", 503);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new AIError("AI가 이 요청에 응답하지 않았습니다. 내용을 바꿔 다시 시도해 주세요.", 422);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new AIError("AI 응답을 끝까지 받지 못했습니다. 입력을 줄여 다시 시도해 주세요.", 502);
  }
  return response.parsed_output as z.infer<T>;
}

export function errorResponse(error: unknown) {
  if (error instanceof AIError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
}
