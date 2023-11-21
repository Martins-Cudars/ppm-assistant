export interface HockeyPlayer {
  age: number;
  name: string;
  careerLongitivity: number;
  skills: HockeySkills;
  qualities: HockeyQualities;
  experience: number;
  overall: number;
}

export interface HockeySkills {
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
}

export interface HockeyQualities {
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
}
