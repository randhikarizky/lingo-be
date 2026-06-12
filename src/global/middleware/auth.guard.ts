import { cookies } from "next/headers";
import { verifyToken } from "../utils/jwt";

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("lingora_token")?.value;

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}
