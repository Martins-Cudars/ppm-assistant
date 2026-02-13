import { positionSettings } from "@/sports/hockey/settings";

import { GrowthPrediction } from "@/types/GrowthData";

export const getCurrentSeasonDay = () => {
  const teamInfoEl = document.querySelector(".top_info_team");

  if (!teamInfoEl) {
    console.error("error getting current season day");
    return 1;
  }

  const dayEl = teamInfoEl.querySelectorAll(".link_r");

  const dayString = dayEl[dayEl.length - 1].textContent;

  if (!dayString) {
    console.error("error getting current season day");
    return 1;
  }

  const regex = /\((\d+)\//g;
  const match = regex.exec(dayString);

  if (!match || !match[1]) {
    console.error("error getting current season day");
    return 1;
  }

  return parseInt(match[1]);
};

export const calculateSeasonProgress = (seasonDay: number) => {
  return seasonDay / 112;
};

export const recalculatePredictDataAccordingToSeasonDay = (
  playerGrowthPrediction: GrowthPrediction,
  position: string,
  day?: number
) => {
  const seasonDay = day || 1;
  const seasonProgress = calculateSeasonProgress(seasonDay);

  const positionRatio =
    positionSettings.find((pos) => pos.name === position)?.positionRatio ?? 1;

  const predictData = playerGrowthPrediction.map((row) => {
    return {
      ...row,
      skill: Math.round(row.skill / positionRatio),
    };
  });

  const newPredictData = predictData.map((row) => {
    const newSkill = Math.round(
      row.skill +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].skill - row.skill
            : -40)
    );

    const newExp = Math.round(
      row.exp +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].exp - row.exp
            : 10)
    );

    return {
      age: row.age,
      skill: newSkill,
      exp: newExp,
    };
  });

  return newPredictData;
};

/**
 * Extracts numeric team ID from a PPM URL
 * @param url - URL string containing team data (e.g., "?data=129853-hc-skanste")
 * @returns Team ID string or null if not found
 */
function extractTeamIdFromUrl(url: string): string | null {
  const match = url.match(/data=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Gets the current user's team ID from the page navigation
 * Tries multiple selectors with fallbacks for different page layouts
 * @returns Team ID string or "unknown" if not found
 */
export function getUserTeamId(): string {
  // Try the top_info_team link first (most common)
  let teamLink = document.querySelector(
    ".top_info_team a[href*='team'], .top_info_team a[href*='komanda']"
  ) as HTMLAnchorElement;

  // Fallback: try by class name
  if (!teamLink) {
    teamLink = document.querySelector(
      "a.link_r[href*='komanda'], a.link_r[href*='team']"
    ) as HTMLAnchorElement;
  }

  // Fallback: try the main navigation team link
  if (!teamLink) {
    teamLink = document.querySelector(
      "a[href*='komanda.html'], a[href*='team.html']"
    ) as HTMLAnchorElement;
  }

  // Fallback: try any link with team data pattern
  if (!teamLink) {
    teamLink = document.querySelector(
      "a[href*='komanda.html?data='], a[href*='team.html?data=']"
    ) as HTMLAnchorElement;
  }

  if (!teamLink) {
    console.warn("[getUserTeamId] Could not find team link in page");
    return "unknown";
  }

  const teamId = extractTeamIdFromUrl(teamLink.href);

  if (!teamId) {
    console.warn("[getUserTeamId] Could not extract team ID from URL:", teamLink.href);
    return "unknown";
  }

  return teamId;
}

/**
 * Gets the team ID from a player profile page
 * @returns Team ID string or "unknown" if not found
 */
export function getPlayerTeamId(): string {
  const playerInfo = document.querySelector(".player_info");

  if (!playerInfo) {
    console.warn("[getPlayerTeamId] Could not find player_info element");
    return "unknown";
  }

  // Look for team link within player_info
  const teamLink = playerInfo.querySelector(
    "a[href*='team'], a[href*='komanda']"
  ) as HTMLAnchorElement;

  if (!teamLink) {
    console.warn("[getPlayerTeamId] Could not find team link in player_info");
    return "unknown";
  }

  const teamId = extractTeamIdFromUrl(teamLink.href);
  return teamId || "unknown";
}
