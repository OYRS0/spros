import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { Moderation } from "@/components/spros/moderation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Модерация — SPROS" };
export default async function Page() {
  await requireChatGPTUser("/moderation");
  return <Moderation />;
}
