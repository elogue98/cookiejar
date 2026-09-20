import type { AuthChangeEvent } from '@supabase/supabase-js'
import type { User } from './userContext'

type State = { user: User | null; isLoading: boolean }

/** Auth event IDs are cache keys only; the server profile endpoint authorizes access. */
export function createUserSession({ fetchProfile, update, unauthorized }: {
  fetchProfile: (signal: AbortSignal) => Promise<Response>
  update: (state: State) => void
  unauthorized: () => void
}) {
  let identity: string | null = null
  let user: User | null = null
  let disposed = false
  let pending: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    pending?.abort()
    pending = null
    clearTimeout(timer)
  }

  function clear() {
    cancel()
    identity = null
    user = null
    if (!disposed) update({ user, isLoading: false })
  }

  async function load() {
    cancel()
    const request = new AbortController()
    pending = request
    const current = () => !disposed && pending === request
    timer = setTimeout(() => {
      if (!current()) return
      cancel()
      update({ user, isLoading: false })
    }, 10_000)
    try {
      const response = await fetchProfile(request.signal)
      if (!current()) return
      if (response.status === 401 || response.status === 403) {
        clear()
        unauthorized()
        return
      }
      if (!response.ok) throw new Error('Profile unavailable')
      const payload = await response.json() as { data?: User }
      if (!current()) return
      user = payload.data ?? null
    } catch {
      // Preserve an already-authorized profile during transient network failures.
      // Server routes continue to enforce authorization on every request.
    } finally {
      if (current()) {
        cancel()
        update({ user, isLoading: false })
      }
    }
  }

  return {
    handle(event: AuthChangeEvent, nextIdentity: string | null) {
      if (disposed) return
      if (event === 'SIGNED_OUT' || !nextIdentity) {
        clear()
        return
      }
      const changed = identity !== nextIdentity
      if (changed) {
        cancel()
        identity = nextIdentity
        user = null
        update({ user, isLoading: true })
      }
      const needsRefresh = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
      if (!changed && !needsRefresh && (pending || user)) return
      // Do not call Supabase auth methods inside its auth event callback.
      void load()
    },
    clear,
    dispose() {
      disposed = true
      cancel()
    },
  }
}
