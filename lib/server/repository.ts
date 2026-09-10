import { database, ensureExamples } from "./database";
import type { Demand, Offer, Profile } from "@/lib/domain/types";
type Row = Record<string, unknown>;
export function demandFromRow(r: Row): Demand {
  return {
    id: String(r.id),
    title: String(r.title),
    category: r.category as Demand["category"],
    location: String(r.location),
    district: String(r.district),
    lat: Number(r.lat),
    lng: Number(r.lng),
    description: String(r.description),
    needs: JSON.parse(String(r.needs)),
    avgCheck: Number(r.avg_check),
    seedVotes: Number(r.seed_votes),
    seedPledgers: Number(r.seed_pledgers),
    seedPledgeTotal: Number(r.seed_pledge_total),
    votes: Number(r.seed_votes) + Number(r.test_votes ?? 0),
    pledgers: Number(r.seed_pledgers) + Number(r.test_pledgers ?? 0),
    pledgeTotal: Number(r.seed_pledge_total) + Number(r.test_pledge_total ?? 0),
    testVotes: Number(r.test_votes ?? 0),
    supported: !!r.supported,
    myPledge: Number(r.my_pledge ?? 0),
    ownerId: r.owner_id ? String(r.owner_id) : null,
    isDemo: !!r.is_demo,
    status: r.status as Demand["status"],
    reason: r.reason ? String(r.reason) : null,
    mergedInto: r.merged_into ? String(r.merged_into) : null,
    createdAt: Number(r.created_at),
    offerCount: Number(r.offer_count ?? 0),
  };
}
export function offerFromRow(r: Row): Offer {
  return {
    id: String(r.id),
    requestId: r.request_id ? String(r.request_id) : null,
    title: String(r.title),
    category: r.category as Offer["category"],
    location: String(r.location),
    lat: Number(r.lat),
    lng: Number(r.lng),
    description: String(r.description),
    budget: Number(r.budget),
    fundingNeeded: Number(r.funding_needed),
    timeline: String(r.timeline),
    benefit: String(r.benefit),
    avgCheck: Number(r.avg_check),
    photoKey: r.photo_key ? String(r.photo_key) : null,
    ownerId: r.owner_id ? String(r.owner_id) : null,
    isDemo: !!r.is_demo,
    createdAt: Number(r.created_at),
    choices: Number(r.choices ?? 0),
    chosen: !!r.chosen,
    interest: r.interest ? String(r.interest) : null,
  };
}
export async function getDataset(profile: Profile | null, ownOnly = false) {
  await ensureExamples();
  const db = database();
  const uid = profile?.id ?? "";
  const [d, o] = await Promise.all([
    db
      .prepare(
        `SELECT r.*, (SELECT COUNT(*) FROM supports s WHERE s.request_id=r.id) test_votes, (SELECT COUNT(*) FROM supports s WHERE s.request_id=r.id AND s.pledge>0) test_pledgers, (SELECT COALESCE(SUM(s.pledge),0) FROM supports s WHERE s.request_id=r.id) test_pledge_total, EXISTS(SELECT 1 FROM supports s WHERE s.request_id=r.id AND s.user_id=?) supported, (SELECT s.pledge FROM supports s WHERE s.request_id=r.id AND s.user_id=?) my_pledge, (SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offer_count FROM requests r WHERE ${ownOnly ? "r.owner_id=? OR (r.status IN ('published','review','restored') AND EXISTS(SELECT 1 FROM supports s WHERE s.request_id=r.id AND s.user_id=?))" : "r.status IN ('published','review','restored') OR r.owner_id=? OR ?=1"} ORDER BY r.created_at DESC LIMIT 500`,
      )
      .bind(uid, uid, uid, ownOnly ? uid : profile?.moderator ? 1 : 0)
      .all<Row>(),
    db
      .prepare(
        `SELECT o.*, (SELECT COUNT(*) FROM choices c WHERE c.offer_id=o.id) choices, EXISTS(SELECT 1 FROM choices c WHERE c.offer_id=o.id AND c.user_id=?) chosen, (SELECT i.kind FROM interests i WHERE i.offer_id=o.id AND i.user_id=?) interest FROM offers o ${ownOnly ? "WHERE (o.owner_id=? OR EXISTS(SELECT 1 FROM interests i WHERE i.offer_id=o.id AND i.user_id=?) OR EXISTS(SELECT 1 FROM choices c WHERE c.offer_id=o.id AND c.user_id=?)) AND (o.request_id IS NULL OR o.owner_id=? OR EXISTS(SELECT 1 FROM requests r WHERE r.id=o.request_id AND r.status IN ('published','review','restored')))" : "WHERE o.request_id IS NULL OR EXISTS(SELECT 1 FROM requests r WHERE r.id=o.request_id AND r.status IN ('published','review','restored'))"} ORDER BY o.created_at DESC LIMIT 500`,
      )
      .bind(...(ownOnly ? [uid, uid, uid, uid, uid, uid] : [uid, uid]))
      .all<Row>(),
  ]);
  return {
    requests: d.results.map(demandFromRow),
    offers: o.results.map(offerFromRow),
    profile,
  };
}
