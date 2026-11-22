export type GrowthPredictionItem = {
  age: number;
  skill: number;
  exp: number;
};

export type GrowthPrediction = GrowthPredictionItem[];

/**
 * The 100% lines behind relative skill, per sport: over every scouted player
 * (`global`) and over the user's league (`league`). Fitted by
 * scripts/fit-relative-skill.ts.
 */
export type RelativeSkillScope = "global" | "league";

export type RelativeSkillReference = Record<RelativeSkillScope, GrowthPrediction>;
