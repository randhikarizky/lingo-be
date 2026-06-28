import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/global/database/prisma";
import { signToken } from "@/global/utils/jwt";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { planService } from "@/features/subscription/application/plan.service";
import { toUserEntity } from "../../data/mappers/user.mapper";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginHandler(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user?.passwordHash) {
      return withCors(errorResponse("Email atau password salah", 401));
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!valid) {
      return withCors(errorResponse("Email atau password salah", 401));
    }

    await planService.ensureUserPlan(user.id);

    const token = signToken({ userId: user.id, email: user.email });

    const response = successResponse(toUserEntity(user), "Login berhasil");

    response.cookies.set("lingora_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return withCors(response);
  } catch {
    return withCors(errorResponse("Gagal login", 500));
  }
}
