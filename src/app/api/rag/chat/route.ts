import type { z } from "zod";
import { ragAnswer } from "@/lib/domain/chat";
import { serverToday } from "@/lib/domain/chat-dates";
import { loadFor } from "@/lib/domain/queries";
import { badRequest, json } from "@/lib/http/respond";
import { requireSession } from "@/lib/http/auth";
import { testHooks } from "@/lib/server/test-hooks";
import { chatSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  // An unparsable body or a failed validation is the client's mistake: 400, nothing logged at error level (chat-polish REQ-23).
  let body: z.infer<typeof chatSchema>;
  try {
    body = chatSchema.parse(await request.json());
  } catch (error) {
    return badRequest(error);
  }

  // Anything that fails from here on is ours: log it with context and answer with a generic 500.
  try {
    const hooks = testHooks(request.headers, process.env);
    const db = await loadFor(auth.user, "chat");
    if (hooks.fail) throw new Error("Injected chat failure (x-e2e-fail)");
    return json(ragAnswer(db, auth.user, body.message, hooks.today ?? serverToday(new Date()), { trace: hooks.trace }));
  } catch (error) {
    console.error("[api/rag/chat]", { userId: auth.user.id, messageLength: body.message.length }, error);
    return json({ error: "Internal error" }, 500);
  }
}
