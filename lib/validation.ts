/**
 * Shared sign-up validation helpers — imported by both the client-side
 * AuthForm (for real-time feedback) and the signUpAction server action
 * (for defense-in-depth enforcement). Keeping the rules in one place means
 * the UI and the server can never drift out of sync.
 */

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordChecklist(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}

/** 0–5 score, one point per requirement met — drives the strength meter. */
export function getPasswordStrengthScore(password: string): number {
  if (!password) return 0;
  return PASSWORD_REQUIREMENTS.reduce(
    (score, requirement) => score + (requirement.test(password) ? 1 : 0),
    0,
  );
}

export type PasswordStrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

export function getPasswordStrengthLabel(score: number): PasswordStrengthLabel {
  if (score <= 2) return "Weak";
  if (score === 3) return "Fair";
  if (score === 4) return "Good";
  return "Strong";
}

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Returns a human-readable error message if the username is invalid, or
 * null if it's valid. Checked in order so the user sees the single most
 * relevant issue rather than every problem at once.
 */
export function getUsernameError(username: string): string | null {
  if (!username) return "Username is required.";
  if (username.length < USERNAME_MIN)
    return `Username must be at least ${USERNAME_MIN} characters.`;
  if (username.length > USERNAME_MAX)
    return `Username must be ${USERNAME_MAX} characters or fewer.`;
  if (/\s/.test(username))
    return "Username can't contain spaces.";
  if (!USERNAME_PATTERN.test(username))
    return "Username can only contain letters, numbers, underscores, and dashes.";
  return null;
}

export function isUsernameValid(username: string): boolean {
  return getUsernameError(username) === null;
}
