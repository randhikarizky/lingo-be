const DEFAULT_KIE_ROOT = "https://api.kie.ai";

/** Root host only — strips trailing `/api/v1` if misconfigured in env. */
export function getKieRootBaseUrl() {
  const raw = (process.env.KIE_AI_BASE_URL ?? DEFAULT_KIE_ROOT).trim().replace(/\/$/, "");
  return raw.replace(/\/api\/v1$/i, "") || DEFAULT_KIE_ROOT;
}

export function getKieChatCompletionsUrl(model: string) {
  return `${getKieRootBaseUrl()}/${model}/v1/chat/completions`;
}

export function getKieJobsUrl(path: "createTask" | "recordInfo") {
  const root = getKieRootBaseUrl();
  if (path === "createTask") {
    return `${root}/api/v1/jobs/createTask`;
  }
  return `${root}/api/v1/jobs/recordInfo`;
}
