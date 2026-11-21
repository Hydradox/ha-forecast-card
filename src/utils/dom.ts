/** Ancestors across shadow roots (parent element, else the host of the shadow root), nearest first. */
export function* composedAncestors(node: Element): Generator<Element> {
  let current: Element | null = node;
  while (current) {
    current = current.parentElement ?? ((current.getRootNode() as ShadowRoot).host ?? null);
    if (current) yield current;
  }
}

/**
 * Nearest dialog around an element, through shadow roots: a native `<dialog>` or one of HA's dialog elements
 * (`ha-dialog`, `ha-md-dialog`, `hui-dialog-edit-card`...). Undefined on the dashboard itself.
 */
export function dialogOf(node: Element): Element | undefined {
  for (const ancestor of composedAncestors(node)) if (/(^|-)dialog$/.test(ancestor.localName)) return ancestor;
  return undefined;
}
