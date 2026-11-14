"use client";

import { useAssistantContext } from "@/components/app/assistant";

// Labels the floating assistant's header while a Compras page is open; the answers do not depend on the page (REQ-4).
export function GroceriesChat() {
  useAssistantContext({ subtitle: "Sobre tus compras" });
  return null;
}
