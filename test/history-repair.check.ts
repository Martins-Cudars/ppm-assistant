/**
 * Assertions for the thousands-comma fix: base/captureUtils.ts stripThousands()
 * and storage/historyRepair.ts repairedOverallRating() - see test/README.md.
 *
 * English training-progress pages print 4-digit ratings as "1,598";
 * parseFloat stopped at the comma, so 8,436 soccer days were stored with OR 1.
 */

import { stripThousands } from "@/base/captureUtils";
import { repairedOverallRating } from "@/storage/historyRepair";

let failures = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failures++;
    console.log("FAIL", name, "-", (e as Error).message);
  }
};
const eq = (a: unknown, b: unknown, m = "") => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

check("thousands commas go, decimals stay", () => {
  eq(parseFloat(stripThousands("1,598")), 1598, "OR");
  eq(parseFloat(stripThousands("12,345")), 12345, "5 digits");
  eq(parseFloat(stripThousands("72.02")), 72.02, "skill");
  eq(parseFloat(stripThousands("335")), 335, "short OR");
  // A decimal comma (2 digits) is not a thousands separator - left alone.
  eq(stripThousands("72,02"), "72,02", "decimal comma untouched");
});

const skills = { goalie: 27, defence: 663.03, midfield: 27, offence: 36, shooting: 116.13, passing: 232.42, technical: 232.42, speed: 232.33, heading: 232.46 };
// Floors: 27 + 663 + 27 + 36 + 116 + 232 + 232 + 232 + 232 = 1797

check("a cut OR is restored to the sum of floored skills", () => {
  eq(repairedOverallRating({ overallRating: 1, skills }), 1797);
});

check("correct and unrepairable entries are left alone", () => {
  eq(repairedOverallRating({ overallRating: 1797, skills }), null, "already right");
  eq(repairedOverallRating({ overallRating: 1 }), null, "no skills");
  eq(repairedOverallRating({ overallRating: 5, skills: { a: 100, b: 200 } }), null, "small sum: not a cut");
  eq(repairedOverallRating({ skills }), null, "no OR at all");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
