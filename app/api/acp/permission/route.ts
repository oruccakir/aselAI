import { z } from "zod";
import { resolveAcpPermissionByDecision } from "@/lib/acp/client";
import { ChatbotError } from "@/lib/errors";

// Resolves permission requests held by the ACP child process — Node.js only.
export const runtime = "nodejs";

const postRequestBodySchema = z.object({
  approved: z.boolean(),
  requestId: z.string().min(1),
});

export async function POST(request: Request) {
  let body: z.infer<typeof postRequestBodySchema>;
  try {
    body = postRequestBodySchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const resolved = resolveAcpPermissionByDecision(
    body.requestId,
    body.approved
  );
  return Response.json({ resolved });
}
