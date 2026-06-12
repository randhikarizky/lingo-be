import { successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function logoutHandler() {
  const response = successResponse(null, "Logout berhasil");

  response.cookies.set("lingora_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return withCors(response);
}
