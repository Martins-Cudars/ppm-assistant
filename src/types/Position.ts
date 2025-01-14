/**
 * Position
 */

export type Grade = {
  label: string;
  class: string;
};

export type RatingSettings = {
  low: number;
  medium: number;
  high: number;
};

export type PositionSkill = {
  position: string;
  level: number;
};

export type PositionPotential = {
  position: string;
  potential: number;
};

/**
 * Hockey
 */

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
  positionRatio: number;
}

/**
 * Soccer
 */

interface SoccerSkills {
  goalie?: number;
  defence?: number;
  midfield?: number;
  offence?: number;
  shooting?: number;
  technical?: number;
  speed?: number;
  passing?: number;
  heading?: number;
}

export interface SoccerPositionSetting {
  name: "GK" | "SD" | "CD" | "SM" | "CM" | "DM" | "SF" | "CF";
  ratios: SoccerSkills;
  bonus?: SoccerSkills;
}

/**
 * Basketball
 */

// TODO: Add Basketball skills
export interface BasketballPositionSetting {
  name: any;
  ratios?: any;
  bonus?: any;
}
