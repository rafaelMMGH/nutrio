import type { Metadata } from "next";
import { Dashboard } from "@/components/nutrio/Dashboard";
import { getPageSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Inicio · NUTRIO" };

export default async function HomePage() {
  await getPageSession();
  return <Dashboard />;
}
