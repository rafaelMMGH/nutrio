import type { ReactNode } from "react";
import { getPageSession } from "@/lib/server/session";

// Modo Cocina (specs/cooking-mode REQ-2): signed-in, but full screen, without the top bar, sidebar or assistant.
export default async function CookingLayout({ children }: { children: ReactNode }) {
  await getPageSession();
  return children;
}
