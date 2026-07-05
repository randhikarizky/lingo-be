export type ScenarioDefinition = {
  id: string;
  label: string;
  category: string;
  objective: string;
  setting: string;
};

export const SCENARIO_CATEGORIES = [
  "Daily Life",
  "Travel",
  "Business",
  "Career",
  "Academic",
  "Healthcare",
] as const;

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    category: "Daily Life",
    objective: "Successfully order a complete meal.",
    setting:
      "You are roleplaying in a restaurant with the learner as a customer.",
  },
  {
    id: "cafe",
    label: "Cafe",
    category: "Daily Life",
    objective: "Order drinks and snacks politely at a cafe.",
    setting: "You are a barista at a cozy cafe.",
  },
  {
    id: "shopping",
    label: "Shopping",
    category: "Daily Life",
    objective: "Ask for sizes, prices, and complete a purchase.",
    setting: "You are a shop assistant helping the learner buy clothes.",
  },
  {
    id: "hotel",
    label: "Hotel",
    category: "Daily Life",
    objective: "Check in and request hotel services confidently.",
    setting: "You are a hotel receptionist assisting a guest.",
  },
  {
    id: "airport",
    label: "Airport",
    category: "Travel",
    objective: "Handle check-in and boarding conversations smoothly.",
    setting: "You are an airline staff member at the airport counter.",
  },
  {
    id: "immigration",
    label: "Immigration",
    category: "Travel",
    objective: "Finish an immigration interview successfully.",
    setting: "You are an immigration officer conducting a short interview.",
  },
  {
    id: "taxi",
    label: "Taxi",
    category: "Travel",
    objective: "Give directions and discuss the route with a driver.",
    setting: "You are a taxi driver in an English-speaking city.",
  },
  {
    id: "train-station",
    label: "Train Station",
    category: "Travel",
    objective: "Buy tickets and ask about train schedules.",
    setting: "You are a ticket officer at a train station.",
  },
  {
    id: "meeting",
    label: "Meeting",
    category: "Business",
    objective: "Participate in a short team meeting professionally.",
    setting: "You are a colleague leading a brief business meeting.",
  },
  {
    id: "presentation",
    label: "Presentation",
    category: "Business",
    objective: "Introduce an idea and respond to audience questions.",
    setting: "You are a mentor helping the learner practice a presentation.",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    category: "Business",
    objective: "Negotiate terms clearly and respectfully.",
    setting: "You are a business partner in a negotiation roleplay.",
  },
  {
    id: "job-interview",
    label: "Job Interview",
    category: "Career",
    objective: "Answer five interview questions confidently.",
    setting: "You are an interviewer conducting a job interview.",
  },
  {
    id: "classroom",
    label: "Classroom",
    category: "Academic",
    objective: "Ask and answer questions during a class discussion.",
    setting: "You are a teacher facilitating classroom conversation.",
  },
  {
    id: "university",
    label: "University",
    category: "Academic",
    objective: "Discuss coursework and campus life with a peer.",
    setting: "You are a university classmate chatting on campus.",
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    category: "Healthcare",
    objective: "Explain symptoms and understand medication advice.",
    setting: "You are a pharmacist helping a customer.",
  },
  {
    id: "clinic",
    label: "Clinic",
    category: "Healthcare",
    objective: "Describe health concerns and follow medical guidance.",
    setting: "You are a clinic receptionist or nurse assisting a patient.",
  },
];

export function getScenario(id: string): ScenarioDefinition {
  return SCENARIOS.find((item) => item.id === id) ?? SCENARIOS[0];
}

export function isValidScenario(id: string): boolean {
  return SCENARIOS.some((item) => item.id === id);
}

export function getScenariosByCategory() {
  return SCENARIO_CATEGORIES.map((category) => ({
    category,
    scenarios: SCENARIOS.filter((item) => item.category === category),
  }));
}
