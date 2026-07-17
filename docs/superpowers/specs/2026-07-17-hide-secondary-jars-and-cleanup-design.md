# Hide Secondary Jars and Cleanup

## Goal

Make Cookie Jar the only product discoverable through application navigation while keeping Tip Jar and Meal Jar available at their existing direct routes for future use. Finish the safe correctness cleanup identified during review without deleting either secondary product.

## Product Visibility

- Cookie Jar navigation will no longer show a Tip Jar or Meal Jar switch.
- Tip Jar (`/places`) and Meal Jar (`/meals`) will remain directly accessible.
- Navigation rendered inside a directly opened secondary product may retain that product's branding and local links, but it will not expose a switch to either of the other jars.
- The existing `tipjar` and `mealjar` themes remain registered because the direct routes still use them.
- No routes, feature source files, database records, or saved browser preferences will be deleted.

## Cleanup Scope

### Meal Jar

- Calculate the progress-bar color from the uncapped percentage while capping only the rendered width, so values over target display as over target.
- Validate persisted macro targets before loading them. Only finite, non-negative numeric values for calories, protein, carbs, and fat are accepted; stale or malformed data falls back to `DEFAULT_TARGET`.
- Correct Meal Jar account-menu and mobile-navigation contrast for direct-route users.
- Keep the existing meal portioning contract: protein and carbohydrate amounts drive portions, while calories and fat are resulting values. Remove the per-meal calorie figure from the target summary so the UI does not promise a calorie constraint the solver does not enforce. Daily progress continues to compare all actual totals with daily targets.
- Add focused unit coverage for macro-target validation and the meal-portioning contract.

### Recipe Import Loading Messages

- Replace random comparator sorting with a non-mutating Fisher–Yates helper.
- Allow an injected random-number function for deterministic tests.
- Shuffle once per loading-overlay mount and preserve the existing message interval and cancellation behavior.

### Tip Jar

- Keep the reviewed type-safety and test improvements for place import.
- Remove the unused existing-place lookup before the conflict-safe upsert, avoiding an unnecessary database round trip without changing the API response or persistence behavior.
- Preserve direct access to `/places` and `/places/import`.

## Error Handling

- Invalid saved Meal Jar targets never enter component state and never produce `NaN` output.
- Empty and single-item loading-message arrays remain valid inputs to the shuffle helper.
- Place import continues to return the existing safe error responses for Google or Supabase failures.

## Testing

- Add failing unit tests first for progress state, saved-target validation, shuffle behavior, and the documented meal-portioning contract.
- Run the focused tests through red-green cycles.
- Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Browser-check Cookie Jar desktop and mobile navigation to confirm neither secondary product is discoverable.
- Browser-check direct `/places` and `/meals` access, Meal Jar contrast, changed controls, and the browser console.

## Out of Scope

- Deleting Tip Jar or Meal Jar.
- Redirecting or blocking their routes.
- Redesigning the meal solver to optimize all four macros simultaneously.
- Changing nutrition values, Google Places behavior, authentication, or database schema.
- Committing, pushing, or deploying without separate authorization.
