"use client";

import { Button } from "@/components/ui/button";

// Shown inside the frame when a signed-in page fails to load; "Reintentar" renders the route again.
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center gap-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-medium">No se pudo cargar esta página</h1>
      <p className="text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
