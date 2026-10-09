import * as z from "zod/v4";
import { errorResponse, generateStructured } from "@/lib/claude";
import { getQuestion } from "@/lib/data";

const RequestSchema = z.object({
  questionId: z.string().max(40).optional(),
  question: z.string().min(1).max(2000),
  passage: z.string().max(20000).optional(),
  answer: z.string().min(1).max(6000),
  target: z.string().max(200).optional(), // 지원 대학/학과
  record: z.string().max(30000).optional(), // 학생이 직접 붙여넣은 생기부 내용 (선택)
  seconds: z.number().int().min(0).max(3600).optional(),
});

const FeedbackSchema = z.object({
  overall: z.string().describe("한두 문장의 총평"),
  scores: z
    .array(
      z.object({
        criterion: z.string().describe("평가 항목 이름"),
        score: z.number().int().describe("1~5점 정수"),
        comment: z.string().describe("이 점수를 준 근거를 답변 표현을 인용해 설명"),
      }),
    )
    .describe("질문 의도 이해, 논리와 구성, 구체성(근거·경험), 진정성과 일관성, 전달력(간결성) 5개 항목"),
  strengths: z.array(z.string()).describe("잘한 점 2~4개"),
  improvements: z.array(z.string()).describe("구체적으로 고칠 점 2~4개"),
  improvedAnswer: z
    .string()
    .describe("학생 답변의 사실과 경험만 사용해 다듬은 답변. 학생이 말하지 않은 활동·성과를 지어내지 말 것"),
  followUps: z.array(z.string()).describe("면접관이 이어서 물을 만한 꼬리 질문 3개"),
});

const SYSTEM = `당신은 한국 대학 수시 면접을 오래 지도해 온 면접 코치입니다. 학생이 실제 대학 면접 질문에 답한 내용을 평가하고 개선 방향을 제시합니다.

원칙:
- 반드시 한국어로 답합니다.
- 평가 근거는 학생 답변의 실제 표현에서 찾고, 필요한 경우 짧게 인용합니다.
- 대학이 공개한 출제 의도나 예시 답안이 주어지면 그것을 평가 기준으로 우선 사용합니다.
- 학생이 말하지 않은 경험, 활동, 성과, 수치를 지어내지 않습니다. 개선 답변은 학생 답변과 (주어진 경우) 학생이 붙여넣은 생활기록부 내용 안에서만 재구성합니다.
- 답변 시간이 주어지면 분량이 적절했는지도 짧게 언급합니다.
- 점수는 1~5 정수이며, 후하게 주지 말고 실제 면접 기준으로 냉정하게 매깁니다.`;

// Claude 응답(긴 생기부 분석 포함)이 1분 이상 걸릴 수 있다
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "입력값이 올바르지 않습니다. (답변은 6,000자 이내)" }, { status: 400 });
    }
    const body = parsed.data;
    const known = body.questionId ? getQuestion(body.questionId) : undefined;

    const parts: string[] = [];
    if (known) {
      parts.push(
        `[출처] ${known.university} ${known.years.join("·")}학년도 공개 면접 문항` +
          (known.admission ? ` / ${known.admission}` : "") +
          (known.unit ? ` / ${known.unit}` : ""),
      );
    }
    if (body.target) parts.push(`[지원 대학/학과] ${body.target}`);
    if (body.passage) parts.push(`[제시문]\n${body.passage}`);
    if (known && known.prompts.length === 0) {
      parts.push(
        "[질문] 대학이 질문 문장을 공개하지 않은 제시문 면접입니다(현장에서 구두로 질문). 학생이 제시문의 핵심과 쟁점을 정확히 파악하고 자기 견해를 근거와 함께 말했는지 평가하세요.",
      );
    } else {
      parts.push(`[질문]\n${body.question}`);
    }
    if (known?.intent) parts.push(`[대학이 공개한 출제 의도]\n${known.intent}`);
    if (known?.sampleAnswer) parts.push(`[대학이 공개한 예시 답안]\n${known.sampleAnswer}`);
    if (body.record) parts.push(`[학생이 제공한 생활기록부 내용]\n${body.record}`);
    if (body.seconds != null) parts.push(`[답변 소요 시간] ${body.seconds}초`);
    parts.push(`[학생 답변]\n${body.answer}`);

    const feedback = await generateStructured({
      system: SYSTEM,
      user: parts.join("\n\n"),
      schema: FeedbackSchema,
    });
    return Response.json(feedback);
  } catch (error) {
    return errorResponse(error);
  }
}
