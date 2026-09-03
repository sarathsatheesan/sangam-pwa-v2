/**
 * SECURITY (M-08, 2026-09-03): real password strength rules.
 * Sign-up previously accepted any 6+ character password (external security
 * review finding M-08). Policy: 8+ characters, at least 3 of 4 character
 * classes, not a known-common password, and not containing the email name.
 */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', '87654321', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'welcome1', 'welcome123', 'admin123', 'letmein1', 'whatever', 'trustno1',
  'dragon123', 'monkey123', 'shadow123', 'master123', 'michael1', 'jennifer',
  'jordan23', 'harley123', 'hunter123', 'ranger123', 'buster123', 'soccer123',
  'batman123', 'test1234', 'pass1234', 'abc12345', 'abcd1234', 'a1b2c3d4',
  '11111111', '00000000', '112233445566', 'qazwsxedc', '1q2w3e4r', '1qaz2wsx',
  'zaq12wsx', 'qwer1234', 'asdf1234', 'zxcv1234', 'changeme', 'internet',
  'computer', 'samsung1', 'iphone123', 'android1', 'google123', 'facebook1',
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
  score: number; // 0 (unusable) … 4 (strong)
}

/** 0–4 score for the strength meter. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (classes >= 3) score++;
  if (classes === 4) score++;
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) score = 1;
  if (pw.length < 8) score = Math.min(score, 1);
  return Math.min(score, 4);
}

export const SCORE_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;
export const SCORE_COLORS = ['#ef4444', '#ef4444', '#f59e0b', '#10b981', '#059669'] as const;

/** Full policy check used at sign-up. */
export function validatePassword(pw: string, email?: string): PasswordCheck {
  const score = passwordScore(pw);
  if (!pw) return { ok: false, message: 'Password is required', score: 0 };
  if (pw.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters', score };
  }
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/[0-9]/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  if (classes < 3) {
    return {
      ok: false,
      message: 'Use at least 3 of: lowercase, uppercase, numbers, symbols',
      score,
    };
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return { ok: false, message: 'That password is too common — pick something more unique', score: 1 };
  }
  const emailName = (email || '').split('@')[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && pw.toLowerCase().includes(emailName)) {
    return { ok: false, message: 'Password must not contain your email name', score: 1 };
  }
  return { ok: true, score };
}
