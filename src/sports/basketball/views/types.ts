import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";

export interface BasketballPlayerListItem {
  player: BasketballPlayer;
  lineupPosition?: string;
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
