import { NextResponse } from "next/server";

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};

export function successResponse<T>(data: T, message = "OK", status = 200) {
  return NextResponse.json(
    { success: true, message, data } satisfies ApiResponse<T>,
    { status }
  );
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message, data: null } satisfies ApiResponse<null>,
    { status }
  );
}
