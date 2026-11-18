"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { api, getErrorMessage } from "@/lib/client/api";
import { useMediaQuery } from "@/lib/client/useMediaQuery";
import { ComidasStep } from "./ComidasStep";
import { ConfirmarStep } from "./ConfirmarStep";
import { DatosStep } from "./DatosStep";
import { SubirStep } from "./SubirStep";
import { confirmChanges, goTo, nameMissing, next, prev, resetAfterChange, wizardSteps, WIZARD_STEPS, type UploadResult, type WizardEdits, type WizardState } from "./upload-wizard-logic";
import "./upload-wizard.css";

const COMPACT_QUERY = "(max-width: 937px)";
const LAST = WIZARD_STEPS.length - 1;

type Busy = "upload" | "confirm" | "delete" | null;
// Where focus goes after the next render, once the controls are enabled again.
type FocusTarget = "heading" | "file" | "upload" | "confirm" | "change";

export function UploadWizard({ onClose, refresh }: { onClose: () => void; refresh: () => void }) {
  const [state, setState] = useState<WizardState>({ step: 0, furthest: 0, data: null });
  const [edits, setEdits] = useState<WizardEdits>({});
  const [busy, setBusy] = useState<Busy>(null);
  // The state update lands a render later; the ref is what stops a second click in the same tick.
  const running = useRef(false);
  const compact = useMediaQuery(COMPACT_QUERY);

  const headings = [useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null)];
  const fileRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element = { heading: headings[state.step].current, file: fileRef.current, upload: submitRef.current, confirm: confirmRef.current, change: changeRef.current }[target];
    element?.focus();
  });

  const data = state.data?.structured_data ?? null;
  const locked = busy !== null;

  /** Runs one request at a time; the action returns where focus lands once the controls are enabled again. */
  async function request(kind: Exclude<Busy, null>, action: () => Promise<FocusTarget | null>) {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    try {
      pendingFocus.current = await action();
    } finally {
      running.current = false;
      setBusy(null);
    }
  }

  const upload = (file: File) => request("upload", async () => {
    try {
      const result: UploadResult = await api("/api/plans/upload", { method: "POST", body: file, headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) } });
      setState({ step: 0, furthest: 0, data: result });
      toast.success("PDF procesado", { description: "Revisa los campos detectados antes de confirmar." });
      refresh();
      return "heading";
    } catch (err) {
      toast.error("No se pudo procesar el PDF", { description: getErrorMessage(err) });
      return "upload";
    }
  });

  const changePdf = () => request("delete", async () => {
    try {
      await api(`/api/plans/${state.data?.plan.id}`, { method: "DELETE" });
      setState(resetAfterChange());
      setEdits({});
      refresh();
      return "file";
    } catch (err) {
      toast.error("No se pudo quitar el PDF", { description: getErrorMessage(err) });
      return "change";
    }
  });

  const confirm = () => request("confirm", async () => {
    try {
      await api(`/api/plans/${state.data?.plan.id}`, { method: "PATCH", body: JSON.stringify(confirmChanges(edits)) });
      onClose();
      toast.success("Plan confirmado");
      refresh();
      return null;
    } catch (err) {
      toast.error("No se pudo confirmar el plan", { description: getErrorMessage(err) });
      return "confirm";
    }
  });

  const move = (change: (state: WizardState) => WizardState) => {
    pendingFocus.current = "heading";
    setState(change);
  };

  // The error shows as soon as there is data, even while Comidas is locked; it never blocks anything.
  const steps = wizardSteps(data);
  const stepper = (
    <Stepper
      steps={steps}
      current={state.step}
      furthest={state.furthest}
      orientation={compact ? "horizontal" : "vertical"}
      compact={compact}
      details="current"
      disabled={locked}
      // A jump keeps focus on the stepper, so keyboard users stay where they were.
      onStepSelect={(index) => setState((current) => goTo(current, index))}
    />
  );

  return (
    <div className="uw-backdrop">
      <section className="uw-modal upload-wizard-modal">
        <header className="uw-header">
          <div className="row between">
            <h2>Creación de Plan Nutricional</h2>
            <Button className="uw-close" variant="ghost" size="icon-sm" title="Cerrar" aria-label="Cerrar" disabled={locked} onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          {compact && <div className="uw-progress">{stepper}</div>}
        </header>
        <div className="uw-body">
          {!compact && <aside className="uw-rail">{stepper}</aside>}
          <main className="uw-content">
            {state.step === 0 && <SubirStep data={data} busy={locked} uploading={busy === "upload"} deleting={busy === "delete"} onUpload={upload} onChangePdf={changePdf} headingRef={headings[0]} fileRef={fileRef} submitRef={submitRef} changeRef={changeRef} />}
            {data && state.step === 1 && <DatosStep data={data} edits={edits} setEdits={setEdits} disabled={locked} headingRef={headings[1]} />}
            {data && state.step === 2 && <ComidasStep data={data} headingRef={headings[2]} />}
            {data && state.step === 3 && <ConfirmarStep data={data} edits={edits} headingRef={headings[3]} />}
          </main>
        </div>
        <footer className="uw-footer row between">
          <Button variant="outline" disabled={locked || state.step === 0} onClick={() => move(prev)}>Anterior</Button>
          <div className="toolbar">
            {data && state.step < LAST && <Button variant="secondary" disabled={locked || (state.step === 1 && nameMissing(data, edits))} onClick={() => move(next)}>Siguiente</Button>}
            {data && state.step === LAST && (
              <Button ref={confirmRef} disabled={locked || nameMissing(data, edits)} aria-busy={busy === "confirm"} onClick={confirm}>
                <CheckCircle2 size={16} />Confirmar plan
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
