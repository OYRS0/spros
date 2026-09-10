import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { Account } from "@/components/spros/account";
export const dynamic = "force-dynamic";
export const metadata = { title: "Мой профиль — SPROS" };
export default async function Page() {
  await requireChatGPTUser("/account");
  return <Account />;
}
