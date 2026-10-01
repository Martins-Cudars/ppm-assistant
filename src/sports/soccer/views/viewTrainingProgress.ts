import { SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { runTrainingProgressView } from "@/base/trainingProgress";

/**
 * Soccer's training-progress page - the same page as hockey's and
 * basketball's, checked on the live site: Date, OR, Goa, Def, Mid, Off, Sho,
 * Pas, Tec, Spe, Hea. The columns follow SoccerSkills' field order. The page
 * logic, the Gather history walk included, is shared: see
 * src/base/trainingProgress.ts.
 */
const viewTrainingProgress = () =>
  runTrainingProgressView<SoccerSkills>({
    sport: "soccer",
    skillColumns: [
      "goalie",
      "defence",
      "midfield",
      "offence",
      "shooting",
      "passing",
      "technical",
      "speed",
      "heading",
    ],
    logTag: "[SoccerTrainingProgress]",
  });

export default viewTrainingProgress;
