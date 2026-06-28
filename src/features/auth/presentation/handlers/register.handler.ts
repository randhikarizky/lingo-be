import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/global/database/prisma";
import { signToken } from "@/global/utils/jwt";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { planService } from "@/features/subscription/application/plan.service";
import { toUserEntity } from "../../data/mappers/user.mapper";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export async function registerHandler(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return withCors(errorResponse("Email sudah terdaftar", 409));
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
      },
    });

    await planService.ensureUserPlan(user.id);

    const token = signToken({ userId: user.id, email: user.email });

    const response = successResponse(
      toUserEntity(user),
      "Registrasi berhasil",
      201
    );

    response.cookies.set("lingora_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return withCors(response);
  } catch {
    return withCors(errorResponse("Gagal registrasi", 500));
  }
}
