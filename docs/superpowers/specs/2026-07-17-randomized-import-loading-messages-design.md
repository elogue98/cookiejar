# Randomized Import Loading Messages

## Goal

Show the recipe importer’s existing loading phrases in a fresh random order for each import. Within one import, each phrase appears once before any phrase repeats.

## Design

Add a small Fisher–Yates shuffle helper that accepts a read-only message list and returns a shuffled copy. The helper must not mutate `LOADING_MESSAGES` and will accept an optional random-number function so tests can exercise it deterministically.

When `LoadingOverlayV2` mounts for an import, initialize its local message sequence by shuffling `LOADING_MESSAGES` once. Keep the existing three-second interval and sequential index advancement. If the overlay unmounts and a new import begins, mounting it again creates a new shuffled sequence.

No phrases, timing, styling, cancellation behavior, or importer API behavior will change.

## Error and Edge-Case Behavior

The current message list is non-empty. The shuffle helper will still support empty and single-item lists without failing. Cycling behavior remains unchanged and only runs while the overlay is mounted.

## Testing

Focused unit tests will verify that the shuffle:

- returns every supplied phrase exactly once;
- does not mutate the source array;
- produces the expected reordered result with controlled randomness; and
- handles empty and single-item arrays.

The relevant focused tests will be run first, followed by the project’s broader required verification for a shared UI component where practical.
