export type AuthActionResult =
  | { status: 'error'; error: string }
  | { status: 'success' }

export type SignupActionResult =
  | { status: 'error'; error: string }
  | { status: 'signed-in' }
  | { status: 'email-confirmation-required'; email: string };
