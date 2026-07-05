const REQUIRED_IN_PRODUCTION = ["JWT_SECRET", "DATABASE_URL"] as const;

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter(
    (key) => !process.env[key]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(`Missing required production env: ${missing.join(", ")}`);
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  return secret ?? "dev-secret-change-me";
}

export function isStoragePublic() {
  return process.env.STORAGE_PUBLIC === "true";
}
