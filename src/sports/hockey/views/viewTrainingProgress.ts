import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import { runTrainingProgressView } from "@/base/trainingProgress";

/**
 * Hockey's training-progress page. Column order: Datums, KR, Vār, Aizs, Uzb,
 * Met, Piesp, Teh, Agr - HockeySkills field order 1:1, the same mapping
 * viewTraining.ts uses. The page logic itself, the Gather history walk
 * included, is shared with basketball: see src/base/trainingProgress.ts.
 */
const viewTrainingProgress = () =>
  runTrainingProgressView<HockeySkills>({
    sport: "hockey",
    skillColumns: ["goalie", "defence", "offence", "shooting", "passing", "technical", "aggression"],
    logTag: "[TrainingProgress]",
  });

export default viewTrainingProgress;
