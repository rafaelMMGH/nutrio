// The press scale depends only on reduced motion and the pending lock, never on the label's instant
// first paint, so the first tap on a freshly mounted or carousel-reached meal still feels pressed.
export function pressScale({ reduced, pending }: { reduced: boolean; pending: boolean }) {
  return reduced || pending ? undefined : { scale: 0.97 };
}
