"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client/api";
import { useMediaQuery } from "@/lib/client/useMediaQuery";
import { ComidasStep } from "./ComidasStep";
import { ConfirmarStep } from "./ConfirmarStep";
import { DatosStep } from "./DatosStep";
import { SubirStep } from "./SubirStep";
import { failureReason, subirControls } from "./upload-phase";
import { confirmChanges, goTo, nameMissing, next, prev, resetAfterChange, wizardSteps, WIZARD_STEPS, type UploadResult, type WizardEdits, type WizardState } from "./upload-wizard-logic";
import { useSubirUpload } from "./useSubirUpload";
import "./upload-wizard.css";

const COMPACT_QUERY = "(max-width: 937px)";
const LAST = WIZARD_STEPS.length - 1;

// Where focus goes after the next render, once the controls are enabled again. Subir's row targets live in useSubirUpload.
type FocusTarget = "heading" | "confirm";

export function UploadWizard({ onClose, refresh }: { onClose: () => void; refresh: () => void }) {
  const [state, setState] = useState<WizardState>({ step: 0, furthest: 0, data: null });
  const [edits, setEdits] = useState<WizardEdits>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // The state update lands a render later; the ref is what stops a second click in the same tick.
  const running = useRef(false);
  const compact = useMediaQuery(COMPACT_QUERY);

  const headings = [useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null)];
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  const upload = useSubirUpload({
    onProcessed: (result: UploadResult) => {
      pendingFocus.current = "heading";
      setState({ step: 0, furthest: 0, data: result });
    },
    onReset: () => {
      setState(resetAfterChange());
      setEdits({});
    },
    refresh
  });

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    ({ heading: headings[state.step].current, confirm: confirmRef.current })[target]?.focus();
  });

  const data = state.data?.structured_data ?? null;
  // Past Subir the PDF is always processed; on Subir the footer, X and stepper follow its phase (REQ-14).
  const controls = subirControls(state.step === 0 ? upload.state.phase : "processed");
  const locked = confirming || controls.stepper === "disabled";

  async function confirm() {
    if (running.current) return;
    running.current = true;
    setConfirming(true);
    // Closing first makes a repeated failure a fresh opening, so it is announced again.
    setConfirmError(null);
    try {
      await api(`/api/plans/${state.data?.plan.id}`, { method: "PATCH", body: JSON.stringify(confirmChanges(edits)) });
      onClose();
      refresh();
    } catch (err) {
      setConfirmError(`No se pudo confirmar el plan: ${failureReason(err)}`);
      pendingFocus.current = "confirm";
    } finally {
      running.current = false;
      setConfirming(false);
    }
  }

  const move = (change: (state: WizardState) => WizardState) => {
    pendingFocus.current = "heading";
    setConfirmError(null);
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
      onStepSelect={(index) => { setConfirmError(null); setState((current) => goTo(current, index)); }}
    />
  );

  return (
    <div className="uw-backdrop">
      <section className="uw-modal upload-wizard-modal">
        <header className="uw-header">
          <div className="row between">
            <h2>Creación de Plan Nutricional</h2>
            <Button className="uw-close" variant="ghost" size="icon-sm" title="Cerrar" aria-label="Cerrar" disabled={confirming || controls.closeX === "disabled"} onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          {compact && <div className="uw-progress">{stepper}</div>}
        </header>
        <div className="uw-body">
          {!compact && <aside className="uw-rail">{stepper}</aside>}
          <main className="uw-content">
            {state.step === 0 && <SubirStep data={data} upload={upload} headingRef={headings[0]} />}
            {data && state.step === 1 && <DatosStep data={data} edits={edits} setEdits={setEdits} disabled={confirming} headingRef={headings[1]} />}
            {data && state.step === 2 && <ComidasStep data={data} headingRef={headings[2]} />}
            {data && state.step === 3 && <ConfirmarStep data={data} edits={edits} headingRef={headings[3]} />}
          </main>
        </div>
        {data && state.step === LAST && <div className="uw-confirm-alert"><Alert tone="warning" open={!!confirmError} title={confirmError ?? ""} /></div>}
        <footer className="uw-footer row between">
          <Button variant="outline" disabled={confirming || state.step === 0} onClick={() => move(prev)}>Anterior</Button>
          <div className="toolbar">
            {data && state.step < LAST && controls.siguiente !== "hidden" && <Button variant="secondary" disabled={locked || controls.siguiente === "disabled" || (state.step === 1 && nameMissing(data, edits))} onClick={() => move(next)}>Siguiente</Button>}
            {data && state.step === LAST && (
              <Button ref={confirmRef} disabled={confirming || nameMissing(data, edits)} aria-busy={confirming} onClick={confirm}>
                {confirming ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <CheckCircle2 size={16} />}Confirmar plan
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
