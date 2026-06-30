import { z } from "zod";

export const uuidSchema = z.string().uuid();

export function parseUuid(value: string, label = "ID") {
  const parsed = uuidSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: `${label} tidak valid`,
    };
  }

  return {
    ok: true as const,
    value: parsed.data,
  };
}
