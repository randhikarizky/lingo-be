import jwt, { type SignOptions } from "jsonwebtoken";

import { getJwtSecret } from "@/global/config/env";

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

export type JwtPayload = {
  userId: string;
  email: string;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}
