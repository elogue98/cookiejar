# Recipe tagging experiment fixtures

`evaluation.json` is a synthetic, hand-labeled control set for the bounded TypeSafe experiment. `repository_cases.json` adds 24 hand-labeled references to existing committed ingredient-highlight fixtures; it does not duplicate their recipe text.

The labels use the frozen experiment taxonomy in `src/lib/recipeTagTaxonomy.ts`. They are provisional evaluation labels, not a new application-wide tag contract.

Annotation rules:

- Label a central ingredient, dish type, cuisine, cooking method, or clearly supported dietary/time property.
- Do not label ingredients mentioned only as incidental sides or serving suggestions.
- Specific and broad ingredient labels may coexist when both are useful (`salmon` and `fish`).
- Do not infer a dietary label from incomplete evidence; vegan/vegetarian labels require the fixture to make that property clear.
- Use `quick` only when the recipe explicitly signals a short preparation time.
- Keep an empty set for a valid no-match control.

Run the local baseline comparison with:

```bash
npm run eval:recipe-tags
```

This never calls an external model. Add `--include-repo` to include the 24 existing repository fixtures in the local evaluation. Add `--live` only to send the selected fixtures to TypeSafe and collect comparison metrics; repository fixtures require that explicit flag combination before leaving the machine. The script reports raw and taxonomy-projected current keyword-fallback output separately from TypeSafe output.

To compare with the production OpenAI-backed tagger as well, opt in explicitly with `--current-ai --live`. That mode requires `OPENAI_API_KEY` and never silently substitutes the keyword fallback. For the full local set, use `npm run eval:recipe-tags -- --include-repo --current-ai --live`; review the fixture privacy before using that command.
