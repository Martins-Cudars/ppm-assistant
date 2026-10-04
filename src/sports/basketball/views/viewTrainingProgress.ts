import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { runTrainingProgressView } from "@/base/trainingProgress";

/**
 * Basketball's training-progress page - the same page as hockey's, verified on
 * the live site in both languages: Date/Datums, OR/KR, Sho/Met, Blk, Pas/Piesp,
 * Tec/Teh, Spe/Ātr, Agr, Jum/Lec, Hgt/Aug. The last column is the player's
 * height that day, stored with each entry - the basketball rating depends on
 * it. Everything else (the Gather history walk included) is shared: see
 * src/base/trainingProgress.ts.
 */
const viewTrainingProgress = () =>
  runTrainingProgressView<BasketballSkills>({
    sport: "basketball",
    skillColumns: ["shooting", "blocking", "passing", "technical", "speed", "aggression", "jumping"],
    heightColumn: 9,
    logTag: "[BasketballTrainingProgress]",
  });

export default viewTrainingProgress;
