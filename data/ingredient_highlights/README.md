# Ingredient Highlight Dataset

This folder stores hand-labeled recipes that we use to verify
`mapIngredientsToSteps` highlighting accuracy. Each file should be a JSON
object with the following shape:

```json
{
  "id": "scallops-bacon-potatoes",
  "title": "Pan-Seared Scallops with Bacon",
  "ingredients": [
    {
      "section": "",
      "items": ["400g Maris Piper potatoes, peeled", "..."]
    }
  ],
  "instructions": [
    {
      "section": "",
      "steps": ["Quarter the potatoes...", "..."]
    }
  ],
  "expectedMatches": {
    "step-0": ["0-3", "0-4"]
  }
}
```

### Field notes

- `ingredients` and `instructions` mirror the component props. We preserve
  sections because certain recipes depend on section affinity.
- `expectedMatches` maps step ids (0-based across all sections) to an array
  of ingredient ids using the `{groupIdx}-{itemIdx}` convention that the UI
  relies on today.

### Labeling workflow

1. Add a raw recipe export to this folder (one file per recipe).
2. Run `npm run label:highlights path/to/file.json`.
3. The CLI will show each step, highlight the current matches, and let you
   override them quickly.
4. Once satisfied, save and commit the updated JSON.

Aim for at least 100 labeled recipes that span different cuisines, writing
styles, and ingredient formats so that we can stress-test new highlighting
tactics.

