import * as z from "zod/v4";
import { errorResponse, generateStructured } from "@/lib/claude";
import { questions } from "@/lib/data";

const RequestSchema = z.object({
  record: z.string().min(50).max(30000),
  university: z.string().max(60).optional(),
  major: z.string().max(100).optional(),
  count: z.number().int().min(3).max(15).default(8),
});

const ResultSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("실제 면접관이 묻는 말투의 질문 한 개"),
      basis: z.string().describe("이 질문의 근거가 된 생활기록부 문장을 원문 그대로 인용"),
      competency: z.enum(["학업역량", "진로역량", "공동체역량", "인성"]),
      intent: z.string().describe("이 질문으로 면접관이 확인하려는 것"),
      followUps: z.array(z.string()).describe("이어질 꼬리 질문 2개"),
    }),
  ),
});

const SYSTEM = `당신은 한국 대학의 학생부종합전형 서류기반 면접 문항을 만드는 입학사정관입니다. 학생이 붙여넣은 학교생활기록부 내용만 근거로 실제 면접에서 나올 법한 질문을 만듭니다.

원칙:
- 반드시 한국어로 작성합니다.
- 모든 질문은 생활기록부에 실제로 적힌 활동·탐구·태도에 근거해야 하며, basis에는 그 근거 문장을 원문 그대로(띄어쓰기 포함) 인용합니다. 생활기록부에 없는 내용을 전제로 한 질문은 만들지 않습니다.
- 활동의 동기, 과정에서의 구체적 역할과 어려움, 배운 개념의 이해 깊이, 이후 확장 탐구, 전공과의 연결, 협업 경험을 고르게 확인합니다.
- 함께 제공되는 '대학 공개 면접 문항'은 실제 대학이 공개한 질문입니다. 문체와 난이도를 참고만 하고 그대로 베끼지 않습니다.
- 학업역량, 진로역량, 공동체역량이 고르게 섞이도록 합니다.`;

function referenceQuestions(university?: string): string[] {
  const docBased = questions.filter((q) => q.format === "서류기반");
  const own = university ? docBased.filter((q) => q.university === university) : [];
  const pool = own.length >= 5 ? own : [...own, ...docBased.filter((q) => q.university !== university)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of pool) {
    const text = q.prompts.join(" ");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(`- (${q.university}${q.competency ? `, ${q.competency}` : ""}) ${text}`);
    if (out.length >= 20) break;
  }
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, "");

// Claude 응답(긴 생기부 분석 포함)이 1분 이상 걸릴 수 있다
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "생활기록부 내용을 50자 이상 30,000자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }
    const { record, university, major, count } = parsed.data;
    const refs = referenceQuestions(university);

    const user = [
      `[지원 대학] ${university || "미정"}`,
      `[지원 학과/전공] ${major || "미정"}`,
      `[만들 질문 수] ${count}개`,
      refs.length ? `[대학 공개 면접 문항 (참고용)]\n${refs.join("\n")}` : "",
      `[학생 생활기록부]\n${record}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await generateStructured({ system: SYSTEM, user, schema: ResultSchema });
    const recordSquashed = squash(record);
    return Response.json({
      questions: result.questions.slice(0, count).map((q) => ({
        ...q,
        // 근거 인용이 실제 생기부 문장인지 확인
        basisVerified: squash(q.basis).length > 0 && recordSquashed.includes(squash(q.basis)),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
