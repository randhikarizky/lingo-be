export const BASE_URL = __ENV.BASE_URL || "http://localhost:406";
export const LOAD_TEST_PASSWORD = __ENV.LOAD_TEST_PASSWORD || "loadtest123";
export const LOAD_TEST_USER_COUNT = Number(__ENV.LOAD_TEST_USER_COUNT || 15);

export const THRESHOLDS = {
  smoke: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.05"],
  },
  chat: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.15"],
  },
  voice: {
    http_req_duration: ["p(95)<8000"],
    http_req_failed: ["rate<0.15"],
  },
  login: {
    http_req_duration: ["p(95)<2000"],
  },
};
