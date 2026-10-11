import { z } from "zod";

const postbackSchema = z.object({
  v: z.literal(1),
  kind: z.enum(["question", "gate", "card"]),
  nodeId: z.string().min(1).max(200),
  buttonId: z.string().min(1).max(200).optional(),
  runId: z.string().min(1).max(200),
}).strict();
export type FlowPostback = Omit<z.infer<typeof postbackSchema>, "v">;
const PREFIX = "fluxo:";

/** Versioned, unambiguous IDs. This codec is not authorization: the runner verifies run ownership. */
export function encodePostback(input: FlowPostback): string {
  const data = postbackSchema.parse({ ...input, v: 1 });
  const payload = PREFIX + Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  if (Buffer.byteLength(payload, "utf8") > 1000) throw new Error("Postback excede 1000 bytes");
  return payload;
}

export function decodePostback(payload: string): FlowPostback | null {
  if (payload.length > 1000 || !payload.startsWith(PREFIX)) return null;
  const encoded = payload.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const parsed = postbackSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    const { kind, nodeId, buttonId, runId } = parsed.data;
    return { kind, nodeId, ...(buttonId ? { buttonId } : {}), runId };
  } catch {
    return null;
  }
}
