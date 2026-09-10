"use client";

import { useEffect } from "react";

/**
 * A neon spotlight that follows the pointer across panels.
 *
 * Mounted once, at the root. It is one pointermove listener on the document
 * rather than a listener per panel, and it writes two custom properties onto
 * whichever panel the pointer is currently over. The glow itself is drawn in
 * CSS from those properties, so there is no React state, no re-render, and
 * nothing here runs on the server.
 *
 * WHY THE LISTENER IS PASSIVE AND CHEAP
 * pointermove fires a great deal. This does one closest() call and two style
 * writes, both on the element already under the cursor, so it does not read
 * layout and cannot cause a synchronous reflow. Anything heavier belongs in a
 * rAF, and anything that reads geometry per move belongs nowhere near this
 * page, which is already running a WebGL backdrop.
 *
 * Touch and keyboard users lose nothing: the glow is a hover affordance, the
 * panels carry their own borders, and every interactive element inside them is
 * a real control with its own focus ring.
 */
export function PanelSpotlight() {
  useEffect(() => {
    // A pointer that cannot hover has nothing to track. This also keeps the
    // listener off phones entirely rather than firing it on every touch drag.
    if (!window.matchMedia("(hover: hover)").matches) return;

    let active: HTMLElement | null = null;

    const clear = () => {
      if (!active) return;
      active.style.removeProperty("--spot-on");
      active = null;
    };

    const onMove = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const panel = target?.closest<HTMLElement>(".panel, .panel-quiet");

      if (!panel) {
        clear();
        return;
      }

      if (panel !== active) {
        clear();
        active = panel;
        panel.style.setProperty("--spot-on", "1");
      }

      // offsetX/offsetY are relative to the padding box of the element the
      // event was dispatched on, which is not necessarily the panel, so the
      // panel's own box is what the position has to be measured against.
      const box = panel.getBoundingClientRect();
      panel.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
      panel.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", clear);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", clear);
      clear();
    };
  }, []);

  return null;
}
