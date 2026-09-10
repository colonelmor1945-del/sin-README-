"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Panel, cx } from "@/components/ui/primitives";

/**
 * Product carousel.
 *
 * Every slide is a live component rendering real data from the dataset, not a
 * screenshot and not a mockup built out of styled divs. So the carousel cannot
 * drift out of date, and what a visitor sees before signing up is literally
 * what they get after.
 *
 * Auto-advance stops the moment someone interacts, and never runs at all under
 * prefers-reduced-motion. A carousel that keeps moving while you are reading
 * slide two is a carousel nobody reads.
 */
export interface Slide {
  id: string;
  label: string;
  headline: string;
  blurb: string;
  /** Where this screen actually lives. Rendered as the way in. */
  href: string;
  content: ReactNode;
}

const INTERVAL_MS = 6000;

export function ProductSlides({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || reduce || slides.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [paused, reduce, slides.length]);

  const active = slides[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
    >
      {/* Tabs. Also the pagination, so there is no second control to explain. */}
      <div
        role="tablist"
        aria-label="Product screens"
        className="flex flex-wrap gap-1.5"
      >
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            role="tab"
            aria-selected={i === index}
            aria-controls={`slide-${slide.id}`}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
            className={cx(
              "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              i === index
                ? "border-accent bg-accent-dim text-accent"
                : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {slide.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          {/*
            Keyed on the slide so the copy re-enters with the panel. Without the
            key React reuses the node and the text swaps without transition,
            which reads as a glitch rather than a change.
          */}
          <motion.div
            key={active.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 className="text-2xl leading-tight font-semibold tracking-tight text-ink">
              {active.headline}
            </h3>
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ink-muted">
              {active.blurb}
            </p>
          </motion.div>

          {/*
            The panel beside this is the real screen, so there has to be a way
            to go and use it. Without this the section is a product tour that
            leads nowhere.
          */}
          <Link
            href={active.href}
            className="group mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent underline-offset-4 hover:underline"
          >
            Open {active.label.toLowerCase()}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Link>

          <p className="mt-4 text-[11px] text-ink-faint">
            Every panel here is the real component, running on the real dataset.
            Nothing on this page is a screenshot.
          </p>
        </div>

        <div
          id={`slide-${active.id}`}
          role="tabpanel"
          aria-label={active.label}
          className="min-w-0"
        >
          <motion.div
            key={active.id}
            initial={reduce ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel className="overflow-hidden">{active.content}</Panel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
