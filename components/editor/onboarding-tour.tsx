"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";

// Each step points at an element marked data-tour="<id>" (spec 49).
const STEPS = [
  { id: "shapes", title: "Shapes", body: "Drag shapes onto the canvas to sketch your system." },
  { id: "ai", title: "AI architect", body: "Describe a system and MindMesh designs it on the canvas." },
  {
    id: "templates",
    title: "Templates",
    body: "Start from a ready-made architecture, filtered for your cloud and industry.",
  },
] as const;

const CARD_WIDTH = 288;
const GAP = 12;
const EDGE = 16;

function targetOf(index: number) {
  return document.querySelector<HTMLElement>(`[data-tour="${STEPS[index].id}"]`);
}

function isOnScreen(index: number) {
  const rect = targetOf(index)?.getBoundingClientRect();
  return (
    !!rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

// The next step in this direction whose target is on screen, or -1; steps without one are skipped.
function findStep(from: number, direction: 1 | -1) {
  for (let index = from + direction; index >= 0 && index < STEPS.length; index += direction) {
    if (isOnScreen(index)) return index;
  }
  return -1;
}

interface Layout {
  target: DOMRect;
  left: number;
  top: number;
  // Above targets in the lower half of the screen (the shape panel), below the rest (the navbar).
  above: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface OnboardingTourProps {
  // Bumped by the UserButton's "Show tour"; any change restarts the tour.
  replay: number;
  // The editor, which gets focus back when the tour ends.
  returnFocusRef: RefObject<HTMLElement | null>;
}

// A three-step first-run walkthrough. Shown while the user's unsafeMetadata.onboardingCompleted
// isn't true; finishing or skipping sets it, so it stays done on every device.
export function OnboardingTour({ replay, returnFocusRef }: OnboardingTourProps) {
  const { user } = useUser();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // Ended in this session; also covers the moment before Clerk's user object updates.
  const [isClosed, setIsClosed] = useState(false);
  // null until the first on-screen step is found.
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // A replay restarts from the first step (adjusted during render).
  const [seenReplay, setSeenReplay] = useState(replay);
  if (replay !== seenReplay) {
    setSeenReplay(replay);
    setIsClosed(false);
    setStepIndex(null);
    setLayout(null);
  }

  const isNewUser = !!user && user.unsafeMetadata.onboardingCompleted !== true;
  const isOpen = !isClosed && (replay > 0 || isNewUser);

  const end = useCallback(() => {
    setIsClosed(true);
    setLayout(null);
    if (user && user.unsafeMetadata.onboardingCompleted !== true) {
      user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, onboardingCompleted: true } })
        .catch((err: unknown) => console.error(err));
    }
    returnFocusRef.current?.focus();
  }, [user, returnFocusRef]);

  const measure = useCallback(() => {
    if (stepIndex === null) return;
    const target = targetOf(stepIndex)?.getBoundingClientRect();
    if (!target) return;
    const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2);
    const above = target.top + target.height / 2 > window.innerHeight / 2;
    setLayout({
      target,
      left: Math.min(
        Math.max(target.left + target.width / 2 - width / 2, EDGE),
        window.innerWidth - width - EDGE
      ),
      top: above ? target.top - GAP : target.bottom + GAP,
      above,
      hasPrevious: findStep(stepIndex, -1) !== -1,
      hasNext: findStep(stepIndex, 1) !== -1,
    });
  }, [stepIndex]);

  // Finds the first step once open, then places the card next to the current target. Reads the
  // DOM, so it runs before paint; setState here is the measure-then-render pattern.
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (stepIndex === null) {
      const first = findStep(-1, 1);
      // Nothing to point at (e.g. a very small window): close for now without marking it done.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- needs the DOM to pick the step
      if (first === -1) setIsClosed(true);
      else setStepIndex(first);
      return;
    }
    measure();
  }, [isOpen, stepIndex, measure]);

  // Focus moves to the card on each step, once it's rendered (the first step renders only after
  // its first measure).
  const isShown = layout !== null;
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!isShown || !card) return;
    card.focus();
    // The UserButton menu ("Show tour") hands focus back to its trigger as it closes, just after
    // this; take it back once on the next frame.
    const frame = requestAnimationFrame(() => {
      if (!card.contains(document.activeElement)) card.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isShown, stepIndex]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen, measure]);

  // Escape skips, unless it's meant for another dialog.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[role=dialog]") && !cardRef.current?.contains(target)) return;
      end();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, end]);

  if (!isOpen || stepIndex === null || !layout) return null;

  const step = STEPS[stepIndex];
  const { target } = layout;

  return (
    <>
      {/* Outlines the target; display only, so the feature underneath works as before. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-50 rounded-xl ring-2 ring-brand"
        style={{ left: target.left, top: target.top, width: target.width, height: target.height }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="fixed z-50 rounded-2xl border border-surface-border bg-surface p-4 shadow-2xl outline-none focus-visible:outline-2 focus-visible:outline-brand"
        style={{
          left: layout.left,
          top: layout.top,
          width: `min(${CARD_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
          transform: layout.above ? "translateY(-100%)" : undefined,
        }}
      >
        <p className="text-xs text-copy-muted">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h2 id={titleId} className="mt-1 text-sm font-medium text-copy-primary">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1 text-sm text-copy-secondary">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={end}>
            Skip
          </Button>
          <div className="flex-1" />
          {layout.hasPrevious && (
            <Button variant="outline" size="sm" onClick={() => setStepIndex(findStep(stepIndex, -1))}>
              Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              const next = findStep(stepIndex, 1);
              if (next === -1) end();
              else setStepIndex(next);
            }}
          >
            {layout.hasNext ? "Next" : "Done"}
          </Button>
        </div>
      </div>
    </>
  );
}
