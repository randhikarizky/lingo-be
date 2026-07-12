import { prisma } from "@/global/database/prisma";
import { getAuthUser } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { toUserEntity } from "../../data/mappers/user.mapper";

export async function meHandler() {
  try {
    const auth = await getAuthUser();

    if (!auth) {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
    });

    if (!user) {
      return withCors(errorResponse("User tidak ditemukan", 404));
    }

    return withCors(successResponse(toUserEntity(user)));
  } catch {
    return withCors(errorResponse("Gagal mengambil data user", 500));
  }
}