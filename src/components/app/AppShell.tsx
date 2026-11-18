"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TopBar, type Chef } from "@/components/nutrio/TopBar";
import { Sidebar } from "@/components/nutrio/Sidebar";
import "@/components/nutrio/tokens.css";
import { ConfirmationDialogHost } from "@/components/app/feedback";
import { AssistantPageProvider, useAssistantState } from "@/components/app/assistant";
import { AssistantChat, SHEET_QUERY } from "@/components/shared/AssistantChat";
import { UploadWizard } from "@/components/app/upload-wizard/UploadWizard";
import "./shell.css";
import { api, getErrorMessage } from "@/lib/client/api";
import { useMediaQuery } from "@/lib/client/useMediaQuery";

export type ShellUser = { name: string; email: string };

type Shell = {
  /** Re-runs the Server Components for the current route and tells client-loaded views to refetch. */
  refresh: () => void;
  openDrawer: () => void;
  openUpload: () => void;
  assistantBusy: boolean;
  askAssistant: (message: string) => Promise<void>;
};

const ShellContext = createContext<Shell | null>(null);

export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside <AppShell>");
  return shell;
}

type Props = { user: ShellUser; chef: Chef; children: ReactNode };

// Frame shared by every signed-in page: top bar, floating assistant and the PDF upload wizard.
export function AppShell({ user, chef, children }: Props) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const assistant = useAssistantState();
  const { setOpen: setAssistantOpen, ask, busy: assistantBusy } = assistant;

  // At ≤640 px the open panel is a modal sheet (REQ-22): the page behind is inert and cannot scroll. Tab wrapping and
  // focus live in AssistantChat; inert alone would let Tab escape to the browser.
  const narrow = useMediaQuery(SHEET_QUERY);
  const sheet = assistant.open && narrow;
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [sheet]);

  // The wizard is modal (REQ-16): while it is open everything behind it is inert, and closing it returns focus to the
  // control that opened it. Inert drops focus to the body, so the opener is remembered here and refocused on close.
  const opener = useRef<HTMLElement | null>(null);
  const inertBehind = sheet || wizardOpen;
  useEffect(() => {
    if (wizardOpen) return;
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected) target.focus();
  }, [wizardOpen]);

  // Every page reads its data on the server, so re-rendering them picks up any change.
  const refresh = useCallback(() => router.refresh(), [router]);

  const openDrawer = useCallback(() => setAssistantOpen(true), [setAssistantOpen]);

  const askAssistant = useCallback((message: string) => ask(message), [ask]);

  const openUpload = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setWizardOpen(true);
  }, []);

  const shell = useMemo<Shell>(() => ({ refresh, openDrawer, assistantBusy, askAssistant, openUpload }), [refresh, openUpload, openDrawer, assistantBusy, askAssistant]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      toast.success("Sesión cerrada");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast.error("No se pudo cerrar sesión", { description: getErrorMessage(err) });
    }
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className="app-shell nt">
        <TopBar user={user} chef={chef} busy={assistantBusy} onAsk={askAssistant} onUpload={openUpload} onLogout={logout} inert={inertBehind} />
        <Sidebar inert={inertBehind} />
        <AssistantPageProvider value={assistant.setPage}>
          <main className="content" inert={inertBehind}>{children}</main>
        </AssistantPageProvider>
        <AssistantChat
          subtitle={assistant.context.subtitle}
          turns={assistant.turns}
          busy={assistant.busy}
          open={assistant.open}
          inert={wizardOpen}
          onOpenChange={assistant.setOpen}
          focusRequest={assistant.focusRequest}
          onSend={assistant.send}
          onSuggest={assistant.send}
          onRetry={assistant.retry}
          onClear={assistant.clear}
        />
        {wizardOpen && <UploadWizard onClose={() => setWizardOpen(false)} refresh={refresh} />}
        <ConfirmationDialogHost />
      </div>
    </ShellContext.Provider>
  );
}
