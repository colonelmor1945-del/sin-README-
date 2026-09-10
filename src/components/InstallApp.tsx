"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker, and offers the install prompt when the browser
 * decides the site qualifies for one.
 *
 * TWO SEPARATE JOBS, ON PURPOSE
 * Registration has to happen everywhere, always. The prompt is a button that
 * only some browsers ever offer, and only after their own engagement
 * heuristics are satisfied. Tying the two together would mean either
 * registering late or rendering a button that does nothing.
 *
 * The button appears only when `beforeinstallprompt` has actually fired, which
 * is the only reliable signal that calling `prompt()` will do something. A
 * hand-rolled "Install app" button on a browser that never fired the event
 * does nothing when pressed, and there is no way to detect that from script.
 * Safari and Firefox never fire it at all: on those, installing is a browser
 * menu action, and no button here can change that.
 */

/** Not in lib.dom yet. Chromium only, which is precisely the point. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "money-lab.install-dismissed";

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Never in development.
    //
    // The cache-first rule assumes /_next/static/ filenames are content
    // hashed, which is true of a build and false of the dev server: there the
    // chunks are called webpack.js and layout.js, and there are hot-update
    // files alongside them. Caching those means editing a component and
    // reloading into the previous version of it, with no clue why. Verified by
    // reading the cache after a dev session and finding exactly that.
    if (process.env.NODE_ENV !== "production") return;

    // After load, so registration never competes with first paint for
    // bandwidth on the visit that matters most.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => console.warn("[pwa] registration failed", error));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    // Someone who said no once should not be asked again on every visit.
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // Private mode, or storage blocked. Not a reason to hide the button.
    }

    const onPrompt = (event: Event) => {
      // Without this Chrome shows its own mini-infobar and this button would
      // be a second, competing ask for the same thing.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };

    const onInstalled = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    // The event is single use. Whatever they chose, it cannot fire again.
    setPrompt(null);

    if (outcome === "dismissed") {
      try {
        localStorage.setItem(DISMISSED, "1");
      } catch {
        // Nothing to do. Worst case they see the button again next visit.
      }
    }
  };

  const dismiss = () => {
    setPrompt(null);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Same.
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:w-[22rem]">
      <div className="panel flex items-center gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-[10px]"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">Install Money Lab</p>
          <p className="text-[12px] text-ink-muted">
            Full screen, straight from your home screen.
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full px-2 py-1 text-[12px] text-ink-faint hover:text-ink"
        >
          Not now
        </button>

        <button
          type="button"
          onClick={install}
          className="neon-hit shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Install
        </button>
      </div>
    </div>
  );
}
