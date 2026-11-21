/**
 * Elements with `role="button"` handle `click` and `keydown` with one handler: a click, or Enter / Space
 * (whose default is cancelled, so Space does not scroll), is an activation; any other key is not.
 */
export function isActivation(event: Event): boolean {
  if (event.type !== "keydown") return true;
  const { key } = event as KeyboardEvent;
  if (key !== "Enter" && key !== " ") return false;
  event.preventDefault();
  return true;
}
