import type { ModerationStatus } from "./types";
const transitions: Record<ModerationStatus, ModerationStatus[]> = {
  published: ["review", "hidden", "merged"],
  review: ["published", "hidden", "merged"],
  hidden: ["restored"],
  restored: ["review", "hidden", "merged"],
  merged: [],
};
export function canTransition(from: ModerationStatus, to: ModerationStatus) {
  return transitions[from]?.includes(to) ?? false;
}
