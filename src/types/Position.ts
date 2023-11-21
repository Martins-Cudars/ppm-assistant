export type Grade = {
  label: string;
  class: string;
};

interface HockeySkills {
  goalie?: number;
  defence?: number;
  offence?: number;
  passing?: number;
  technical?: number;
  shooting?: number;
  aggression?: number;
}

export interface HockeyPositionSetting {
  name: "G" | "D" | "W" | "C";
  ratios: HockeySkills;
  bonus?: HockeySkills;
}
