import * as z from "zod/v4";
import { citation, filterQuestions, getQuestion } from "@/lib/data";
import { FORMATS } from "@/lib/types";

const RequestSchema = z.object({
  ids: z.array(z.string().max(40)).max(30).optional(),
  university: z.string().max(60).optional(),
  format: z.enum(FORMATS).optional(),
  competency: z.string().max(40).optional(),
  count: z.number().int().min(1).max(20).default(5),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const { ids, count, ...filter } = parsed.data;

  let picked;
  if (ids?.length) {
    picked = ids.map(getQuestion).filter((q) => q != null);
  } else {
    const pool = filterQuestions(filter);
    // Fisher–Yates shuffle, then take `count`
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    picked = arr.slice(0, count);
  }

  return Response.json({
    questions: picked.map((q) => ({ ...q, citations: citation(q) })),
  });
}
