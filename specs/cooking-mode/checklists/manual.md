# Manual check: Modo Cocina on a phone (T020)

For the user, on the real devices. The e2e test covers the logic with stubbed browser APIs; these need real hardware.
Open any recipe → **Modo Cocina**. Tick each item, or note what happened.

## iPhone, Safari

- [ ] The screen does not turn off while Modo Cocina is open (wait past your auto-lock time without touching it). No "Tu pantalla podría apagarse" note.
- [ ] Lock the phone, unlock it: you are on the same step, and the screen again stays awake.
- [ ] Tap the microphone: Safari asks for the microphone (and speech recognition) once; "Escuchando…" shows.
- [ ] The current screen is read aloud in Spanish; say "siguiente", "atrás", "repetir" from about 1 m away, with the kitchen's normal noise.
- [ ] While the app reads a step, it does not react to its own voice.
- [ ] Leave the phone silent for a minute with voice on: it still listens afterwards.
- [ ] Swipe left and right to change steps; scrolling a long step up and down does not change it.
- [ ] Start a timer (a step that says "10 minutos", or write one with Editar → Preparación), move to another step: the yellow chip counts down. At zero: a sound, and "¡Tiempo!" on screen.
- [ ] Rotate the phone: the layout fits, the step and timer stay.

## Android, Chrome

- [ ] Same items as above.
- [ ] At the end of a timer the phone also vibrates.

## Both

- [ ] From the dashboard, "Modo Cocina" next to "Marcar cumplida" opens the meal on screen.
- [ ] On "¡Listo!", "Marcar como hecha (…)" marks today's meal; the dashboard shows it as done; "Deshacer" in the toast undoes it.
- [ ] Reload in the middle of a recipe: "Retomamos donde te quedaste." and "Empezar de nuevo" work.
