import { isTemporaryAuthError } from './authAvailability'

type SignInAuth = {
  signInWithOtp: (credentials: {
    email: string
    options: { shouldCreateUser: boolean; emailRedirectTo: string }
  }) => Promise<{ error: unknown }>
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
    return 'Too many sign-in links have been requested. Please wait before trying again, or use the most recent email.'
  }
  if (isTemporaryAuthError(error)) {
    return 'We could not connect to the sign-in service. Your email address may be correct. Please try again later.'
  }
  return 'We could not send a sign-in link. Check that you are using your invited family email and try again.'
}

export async function sendSignInLink(auth: SignInAuth, email: string, redirectTo: string): Promise<string | null> {
  try {
    const { error } = await auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    })
    return error ? errorMessage(error) : null
  } catch (error) {
    return errorMessage(error)
  }
}
