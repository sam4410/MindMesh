Add a short first-run walkthrough in the editor, so new users find the shape panel, the AI architect, and the templates.

## Implementation

1. Mark the targets.
   - add `data-tour="shapes"` to the shape panel, `data-tour="ai"` to the AI button in the navbar, and `data-tour="templates"` to the Templates button

2. Create `components/editor/onboarding-tour.tsx`.
   - three steps:
     1. Shapes: "Drag shapes onto the canvas to sketch your system."
     2. AI: "Describe a system and MindMesh designs it on the canvas."
     3. Templates: "Start from a ready-made architecture, filtered for your cloud and industry."
   - each step shows a small card positioned next to its target using `getBoundingClientRect()`, recalculated on window resize
   - controls: Next, Back, Skip; Escape skips
   - accessibility: the card has `role="dialog"`, a label, focus moves to the card, and focus returns to the editor when the tour ends
   - if a target isn't on screen, skip that step

3. Remember completion per user.
   - show the tour when the signed-in user's `unsafeMetadata.onboardingCompleted` is not true
   - on finish or skip, set it with `user.update({ unsafeMetadata: { ...user.unsafeMetadata, onboardingCompleted: true } })` from `useUser()`
   - this keeps the choice across devices

4. Allow replay.
   - add a "Show tour" item to the `UserButton` menu with `UserButton.Action`, which restarts the tour

## Scope Limits

- don't add a tour library dependency
- don't add more than three steps
- don't change the features the tour points at

## Check When Done

- A new user sees the three-step tour on their first visit to a project.
- Skip or finish stops it from appearing again, also on another device.
- "Show tour" replays it.
- The tour is keyboard-accessible.
- `npm run build` passes.
