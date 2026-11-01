import { recipeChanges, type RecipeContext, type RecipeProposal } from '@/lib/cookieBotRecipe'
import styles from './CookieBot.module.css'

export default function CookieBotPreview({
  original,
  proposal,
  saving,
  onApply,
  onCancel,
}: {
  original: RecipeContext
  proposal: RecipeProposal
  saving: boolean
  onApply: () => void
  onCancel: () => void
}) {
  const changes = recipeChanges(original, proposal)
  return (
    <section className={styles.preview} aria-label="Proposed recipe changes">
      <div className={styles.previewHeading}>
        <span>RECIPE PREVIEW</span>
        <h3>{changes.length ? 'A change you can check first.' : 'No changes to apply.'}</h3>
        <p>Your saved recipe stays as it is until you apply these changes.</p>
      </div>
      {changes.map((change) => (
        <details
          key={change.label}
          open={change.label === 'Ingredients' || change.label === 'Servings'}
        >
          <summary>{change.label}</summary>
          <div className={styles.comparison}>
            <div>
              <span>Current</span>
              {change.before.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div>
              <span>Proposed</span>
              {change.after.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </details>
      ))}
      <div className={styles.previewActions}>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={saving || !changes.length}
          className={styles.apply}
        >
          {saving ? 'Saving…' : 'Apply changes'}
        </button>
      </div>
    </section>
  )
}
