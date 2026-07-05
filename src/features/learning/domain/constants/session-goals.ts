import type { DifficultyId } from "@/features/learning/domain/constants/difficulties";
import type { SessionGoal } from "@/features/learning/domain/types/learning-session.types";

type GoalTemplate = {
  id: SessionGoal["id"];
  emoji: string;
  label: string;
  getTarget: (difficulty: DifficultyId) => number;
};

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "complete-sentences",
    emoji: "🎯",
    label: "Gunakan minimal {target} kalimat lengkap",
    getTarget: (difficulty) =>
      difficulty === "beginner" ? 3 : difficulty === "intermediate" ? 5 : 7,
  },
  {
    id: "new-vocabulary",
    emoji: "🎯",
    label: "Pelajari {target} kosakata baru dari koreksi tutor",
    getTarget: (difficulty) =>
      difficulty === "beginner" ? 2 : difficulty === "intermediate" ? 3 : 4,
  },
  {
    id: "english-only",
    emoji: "🎯",
    label: "Hindari menggunakan bahasa Indonesia",
    getTarget: () => 0,
  },
  {
    id: "independent-practice",
    emoji: "🎯",
    label: "Selesaikan latihan tanpa minta bantuan",
    getTarget: (difficulty) =>
      difficulty === "beginner" ? 3 : difficulty === "intermediate" ? 4 : 5,
  },
];

export function buildSessionGoalTemplates(difficulty: string): SessionGoal[] {
  const difficultyId = (
    difficulty === "intermediate" || difficulty === "advanced"
      ? difficulty
      : "beginner"
  ) as DifficultyId;

  return GOAL_TEMPLATES.map((template) => {
    const target = template.getTarget(difficultyId);
    const label = template.label.replace("{target}", String(target));

    return {
      id: template.id,
      emoji: template.emoji,
      label,
      target,
      progress: 0,
      progressLabel: "",
      achieved: false,
    };
  });
}

export function getSessionGoalPreviews() {
  return (["beginner", "intermediate", "advanced"] as DifficultyId[]).map(
    (difficulty) => ({
      difficulty,
      goals: buildSessionGoalTemplates(difficulty).map(
        ({ id, emoji, label, target }) => ({
          id,
          emoji,
          label,
          target,
        }),
      ),
    }),
  );
}
