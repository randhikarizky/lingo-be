export type AssistanceAction =
  | "tooltip"
  | "hint"
  | "example"
  | "coach"
  | "dismiss"
  | "sync";

export type AssistanceLevelUsed = "none" | "hint" | "example" | "coach";

export type MissionObjectiveStatus = {
  id: string;
  label: string;
  goal: string;
  tips: string[];
  difficultyStars: number;
  achieved: boolean;
  isActive: boolean;
};

export type AssistanceState = {
  hintCount: number;
  lastHintAt: string | null;
  maxLevelUsed: AssistanceLevelUsed;
  failedAttempts: number;
  lastProgressAt: string | null;
  objectiveProgress: Record<string, boolean>;
};

export type AssistanceCooldown = {
  allowed: boolean;
  waitSeconds: number;
};

export type AssistanceResponse = {
  missionObjectives: MissionObjectiveStatus[];
  activeObjectiveId: string | null;
  stuckSuggested: boolean;
  cooldown: AssistanceCooldown;
  hintText?: string;
  examples?: string[];
  coachMessage?: string;
  assistanceLevel: AssistanceLevelUsed;
  hintCount: number;
};
