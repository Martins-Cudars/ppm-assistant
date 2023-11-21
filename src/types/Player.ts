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
  [key: string]: number;
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
}

export interface HockeyQualities {
  [key: string]: number;
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
}

export interface SoccerPlayer {
  age: number;
  name: string;
  careerLongitivity: number;
  skills: SoccerSkills;
  qualities: SoccerQualities;
  experience: number;
  overall: number;
}

export interface SoccerSkills {
  [key: string]: number;
  goalie: number;
  defence: number;
  midfield: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  speed: number;
  heading: number;
}

export interface SoccerQualities {
  [key: string]: number;
  goalie: number;
  defence: number;
  midfield: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  speed: number;
  heading: number;
}

export interface BasketballPlayer {
  age: number;
  name: string;
  careerLongitivity: number;
  skills: BasketballSkills;
  qualities: BasketballQualities;
  experience: number;
  height: number;
  overall: number;
}

export interface BasketballSkills {
  [key: string]: number;
  shooting: number;
  blocking: number;
  passing: number;
  technical: number;
  speed: number;
  aggression: number;
  jumping: number;
}

export interface BasketballQualities {
  [key: string]: number;
  shooting: number;
  blocking: number;
  passing: number;
  technical: number;
  speed: number;
  aggression: number;
  jumping: number;
}
