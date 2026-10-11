/**
 * DOM elements pinned to points of the 3D scene (stone counts, direction buttons). The
 * HTML lives outside the canvas; a projector inside it moves each element every frame.
 * Cheaper and calmer than one React root per label.
 */
export interface Anchor {
  el: HTMLElement;
  /** World point the element sits on. */
  at: [number, number, number];
  /** Optional world point the element points towards: sets the CSS variable --angle. */
  towards?: [number, number, number];
}

export const anchors = new Map<string, Anchor>();

/** Ref callback that registers an element under `id` while it is mounted. */
export const anchorRef =
  (id: string, at: Anchor['at'], towards?: Anchor['towards']) => (el: HTMLElement | null) => {
    if (el) anchors.set(id, towards ? { el, at, towards } : { el, at });
    else anchors.delete(id);
  };
