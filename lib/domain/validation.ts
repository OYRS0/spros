import { z } from "zod";
export const categorySchema = z.enum([
  "food",
  "coffee",
  "grocery",
  "sport",
  "kids",
  "pets",
  "beauty",
  "auto",
  "services",
  "fun",
  "other",
]);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const point = {
  lat: z.number().finite().min(54).max(57.5),
  lng: z.number().finite().min(35).max(41),
};
export const requestSchema = z.object({
  title: text(5, 100),
  category: categorySchema,
  location: text(2, 100),
  district: text(2, 100),
  ...point,
  description: text(15, 2000),
  needs: z.array(text(2, 100)).max(10),
  avgCheck: z.number().int().min(0).max(10000000),
  pledge: z.union([
    z.literal(0),
    z.literal(1000),
    z.literal(5000),
    z.literal(15000),
    z.literal(50000),
  ]),
  confirmedDistinct: z.boolean().default(false),
});
export const offerSchema = z
  .object({
    requestId: z.string().max(100).nullable(),
    title: text(5, 100),
    category: categorySchema,
    location: text(2, 100),
    ...point,
    description: text(30, 3000),
    budget: z.number().int().min(1).max(10000000000),
    fundingNeeded: z.number().int().min(0).max(10000000000),
    timeline: text(3, 200),
    benefit: text(5, 1000),
    avgCheck: z.number().int().min(0).max(10000000),
    photoKey: z.string().max(100).nullable(),
  })
  .refine(
    (v) => v.fundingNeeded <= v.budget,
    "Необходимая сумма не может превышать бюджет",
  );
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("support"),
    requestId: text(1, 100),
    pledge: z.union([
      z.literal(0),
      z.literal(1000),
      z.literal(5000),
      z.literal(15000),
      z.literal(50000),
    ]),
  }),
  z.object({ action: z.literal("unsupport"), requestId: text(1, 100) }),
  z.object({
    action: z.literal("report"),
    requestId: text(1, 100),
    reason: text(3, 100),
    detail: z.string().trim().max(1000),
  }),
  z.object({
    action: z.literal("appeal"),
    requestId: text(1, 100),
    text: text(20, 2000),
  }),
  z.object({ action: z.literal("choose"), offerId: text(1, 100) }),
  z.object({
    action: z.literal("interest"),
    offerId: text(1, 100),
    kind: z.enum([
      "support",
      "preorder",
      "certificate",
      "bonus",
      "invest",
      "none",
    ]),
  }),
]);
