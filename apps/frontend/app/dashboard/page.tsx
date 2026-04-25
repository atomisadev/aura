import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { getServerSession } from "@/lib/server-session";

export default async function DashboardPage() {
  const headerStore = await headers();
  const session = await getServerSession(headerStore.get("cookie"));

  if (!session) {
    redirect("/");
  }

  return <DashboardClient initialSession={session} />;
}
