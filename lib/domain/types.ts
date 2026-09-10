export type CategoryId =
  | "food"
  | "coffee"
  | "grocery"
  | "sport"
  | "kids"
  | "pets"
  | "beauty"
  | "auto"
  | "services"
  | "fun"
  | "other";
export type ModerationStatus =
  | "published"
  | "review"
  | "merged"
  | "hidden"
  | "restored";
export type Demand = {
  id: string;
  title: string;
  category: CategoryId;
  location: string;
  district: string;
  lat: number;
  lng: number;
  description: string;
  needs: string[];
  avgCheck: number;
  seedVotes: number;
  seedPledgers: number;
  seedPledgeTotal: number;
  votes: number;
  pledgers: number;
  pledgeTotal: number;
  testVotes: number;
  supported: boolean;
  myPledge: number;
  ownerId: string | null;
  isDemo: boolean;
  status: ModerationStatus;
  reason: string | null;
  mergedInto: string | null;
  createdAt: number;
  offerCount: number;
};
export type Offer = {
  id: string;
  requestId: string | null;
  title: string;
  category: CategoryId;
  location: string;
  lat: number;
  lng: number;
  description: string;
  budget: number;
  fundingNeeded: number;
  timeline: string;
  benefit: string;
  avgCheck: number;
  photoKey: string | null;
  ownerId: string | null;
  isDemo: boolean;
  createdAt: number;
  choices: number;
  chosen: boolean;
  interest: string | null;
};
export type Profile = {
  id: string;
  name: string;
  district: string;
  phoneVerified: boolean;
  residencyVerified: boolean;
  moderator: boolean;
};
export type Dataset = {
  requests: Demand[];
  offers: Offer[];
  profile: Profile | null;
};
export type BusinessFilters = {
  minVotes: number;
  maxCheck: number;
  minPledge: number;
  radius: number;
};
export type Point = { lat: number; lng: number };
