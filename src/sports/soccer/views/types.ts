import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

export interface SoccerPlayerListItem {
  player: SoccerPlayer;
  profileUrl?: string;
  countryFlag?: {
    href?: string;
    src: string;
    alt?: string;
    title?: string;
  };
  injuryIndicator?: {
    src: string;
    alt?: string;
    title?: string;
  };
}
