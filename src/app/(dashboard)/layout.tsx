import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { chefSelection, loadFor } from "@/lib/domain/queries";
import { getPageSession } from "@/lib/server/session";

// Every signed-in page shares this frame.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await getPageSession();
  const db = await loadFor(user, "chef");
  return (
    <AppShell user={{ name: user.name, email: user.email }} chef={chefSelection(db, user.id)}>
      {children}
    </AppShell>
  );
}
