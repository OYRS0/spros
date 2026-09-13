import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { Admin } from "@/components/spros/admin";
export const dynamic = "force-dynamic";
export const metadata = { title: "Управление пилотом — SPROS" };
export default async function Page() {
  await requireChatGPTUser("/admin");
  return <Admin />;
}
