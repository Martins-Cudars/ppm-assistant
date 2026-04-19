import { BasePlayer, BaseInfo } from "@/classes/BasePlayer";
import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";

export type ContractInfo = {
  contractDays?: number;      // Days remaining on contract
  salary?: number;            // Current salary
  daysInTeam?: number;        // Days player has been on team
  autoRenewal?: boolean;      // Auto-renewal enabled
};

export type HockeyPlayerInfo = BaseInfo & {
  preferredSide: "L" | "R" | "U";
  countryImage?: string;
  countryLink?: string;
  teamPosition?: string;
  contract?: ContractInfo;    // Grouped contract/financial data
};

export type HockeyPlayerPosition = {
  name: "D" | "W" | "C" | "G" | "?";
  baseRating: number;
  bonusRating: number;
  expBonus: number;
  ratingWithBonus: number;
  ratingWithXp: number;
};

export type HockeyPlayerTrainingQuality = {
  position: HockeyPlayerPosition["name"];
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export type HockeySkills = {
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
};

export type ScoutingStatus = "SCOUTED" | "IN_PROGRESS" | "UNSCOUTED";

export class HockeyPlayer extends BasePlayer {
  public preferredSide: "L" | "R" | "U";
  public countryImage?: string;
  public countryLink?: string;
  public teamPosition?: string;
  public contract?: ContractInfo;
  public scoutingStatus: ScoutingStatus;
  public positions: HockeyPlayerPosition[] = []; // Initialize arrays
  public positionTrainingQualities: HockeyPlayerTrainingQuality[] = []; // Initialize arrays

  constructor(
    baseInfo: HockeyPlayerInfo,
    updatedAt = new Date(),
    scoutingStatus: ScoutingStatus = "UNSCOUTED",
    isVisible = false,
    seasonDay = 1,
    skills?: HockeySkills, // Use optional parameter syntax
    experience?: number, // Use optional parameter syntax
    trainingQualities?: Record<string, number>, // Use optional parameter syntax
    injuryDays = 0
  ) {
    super(
      baseInfo,
      updatedAt,
      scoutingStatus === "SCOUTED",
      isVisible,
      seasonDay,
      skills,
      experience,
      trainingQualities,
      injuryDays
    );
    this.preferredSide = baseInfo.preferredSide;
    this.countryImage = baseInfo.countryImage;
    this.countryLink = baseInfo.countryLink;
    this.teamPosition = baseInfo.teamPosition;
    this.contract = baseInfo.contract;
    this.scoutingStatus = scoutingStatus;
  }

  protected getCalculationProfile(): PlayerCalculationProfile {
    return hockeyPlayerProfile;
  }
}
