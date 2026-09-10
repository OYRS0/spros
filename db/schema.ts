import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  district: text("district").notNull().default(""),
  phoneVerifiedAt: integer("phone_verified_at"),
  residencyVerifiedAt: integer("residency_verified_at"),
  createdAt: integer("created_at").notNull(),
  suspended: integer("suspended").notNull().default(0),
});
export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    district: text("district").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    description: text("description").notNull(),
    needs: text("needs").notNull(),
    avgCheck: integer("avg_check").notNull().default(0),
    seedVotes: integer("seed_votes").notNull().default(0),
    seedPledgers: integer("seed_pledgers").notNull().default(0),
    seedPledgeTotal: integer("seed_pledge_total").notNull().default(0),
    ownerId: text("owner_id").references(() => users.id),
    isDemo: integer("is_demo").notNull().default(1),
    status: text("status").notNull().default("published"),
    reason: text("reason"),
    mergedInto: text("merged_into"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_requests_status_category").on(t.status, t.category),
    index("idx_requests_owner").on(t.ownerId),
  ],
);
export const supports = sqliteTable(
  "supports",
  {
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    pledge: integer("pledge").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.userId] }),
    index("idx_supports_user").on(t.userId),
  ],
);
export const offers = sqliteTable(
  "offers",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").references(() => requests.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    description: text("description").notNull(),
    budget: integer("budget").notNull(),
    fundingNeeded: integer("funding_needed").notNull(),
    timeline: text("timeline").notNull(),
    benefit: text("benefit").notNull(),
    avgCheck: integer("avg_check").notNull(),
    photoKey: text("photo_key"),
    ownerId: text("owner_id").references(() => users.id),
    isDemo: integer("is_demo").notNull().default(1),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_offers_request").on(t.requestId),
    index("idx_offers_owner").on(t.ownerId),
  ],
);
export const choices = sqliteTable(
  "choices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    index("idx_choices_offer").on(t.offerId),
  ],
);
export const interests = sqliteTable(
  "interests",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id),
    kind: text("kind").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.offerId] })],
);
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    detail: text("detail").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_reports_user_request").on(t.userId, t.requestId),
    index("idx_reports_status").on(t.status),
  ],
);
export const appeals = sqliteTable(
  "appeals",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    text: text("text").notNull(),
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_appeals_request_status").on(t.requestId, t.status)],
);
export const moderationEvents = sqliteTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_moderation_request").on(t.requestId)],
);
export const limits = sqliteTable("action_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
});
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull(),
});
