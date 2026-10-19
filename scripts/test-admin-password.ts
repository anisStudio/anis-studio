// Admin password change + recovery helpers (no network, no real emails).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PASSWORD_RECOVERY_PATH,
  buildAdminPasswordRecoveryRedirectTo,
  classifyRecoveryLinkError,
  isAuthRecoveryCallback,
  messageForPasswordValidation,
  parseAuthCallbackParams,
  validateNewPasswordPair,
} from '../src/lib/adminPassword.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 8)
assert.equal(
  buildAdminPasswordRecoveryRedirectTo('https://anislrc.hr'),
  'https://anislrc.hr/admin/reset-password',
)
assert.equal(
  buildAdminPasswordRecoveryRedirectTo('https://anislrc.hr/'),
  'https://anislrc.hr/admin/reset-password',
)
assert.equal(
  buildAdminPasswordRecoveryRedirectTo(
    'https://anis-studio-1gj4fs3hm-anamarijas-projects-bbe91a00.vercel.app',
  ),
  'https://anis-studio-1gj4fs3hm-anamarijas-projects-bbe91a00.vercel.app/admin/reset-password',
)

assert.equal(
  validateNewPasswordPair({ newPassword: 'short', confirmPassword: 'short' }),
  'too_short',
)
assert.equal(
  validateNewPasswordPair({
    newPassword: 'long-enough',
    confirmPassword: 'different1',
  }),
  'mismatch',
)
assert.equal(
  validateNewPasswordPair({
    newPassword: 'long-enough',
    confirmPassword: 'long-enough',
    currentPassword: 'long-enough',
  }),
  'same_as_current',
)
assert.equal(
  validateNewPasswordPair({
    newPassword: 'long-enough',
    confirmPassword: 'long-enough',
    currentPassword: 'old-password',
  }),
  null,
)
assert.match(messageForPasswordValidation('too_short'), /8/)

const expired = parseAuthCallbackParams(
  'https://anislrc.hr/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
)
assert.equal(expired.errorCode, 'otp_expired')
assert.equal(classifyRecoveryLinkError(expired), 'otp_expired')
assert.equal(isAuthRecoveryCallback(expired), true)

const recoveryHash = parseAuthCallbackParams(
  'https://anislrc.hr/admin/reset-password#type=recovery&access_token=x&refresh_token=y',
)
assert.equal(recoveryHash.type, 'recovery')
assert.equal(recoveryHash.hasAccessToken, true)
// Ensure parser does not echo token material in returned object keys beyond flags
assert.equal('access_token' in recoveryHash, false)

const pkce = parseAuthCallbackParams(
  'https://anislrc.hr/admin/reset-password?code=abc',
)
assert.equal(pkce.hasAuthCode, true)

// Simulated Auth API shapes for change-password UX (no real calls)
function simulateChangePasswordResult(opts: {
  reauthOk: boolean
  updateOk: boolean
  isAdmin: boolean
}): 'ok' | 'bad_current' | 'not_admin' | 'update_fail' {
  if (!opts.isAdmin) return 'not_admin'
  if (!opts.reauthOk) return 'bad_current'
  if (!opts.updateOk) return 'update_fail'
  return 'ok'
}
assert.equal(
  simulateChangePasswordResult({ reauthOk: false, updateOk: true, isAdmin: true }),
  'bad_current',
)
assert.equal(
  simulateChangePasswordResult({ reauthOk: true, updateOk: true, isAdmin: false }),
  'not_admin',
)
assert.equal(
  simulateChangePasswordResult({ reauthOk: true, updateOk: true, isAdmin: true }),
  'ok',
)

const provider = readFileSync(join(root, 'src/providers/AdminAuthProvider.tsx'), 'utf8')
assert.match(provider, /changePassword/)
assert.match(provider, /requestPasswordReset/)
assert.match(provider, /completePasswordRecovery/)
assert.match(provider, /resetPasswordForEmail/)
assert.match(provider, /updateUser\(\{\s*password/)
assert.match(provider, /signInWithPassword/)
assert.doesNotMatch(provider, /service_role/)
assert.doesNotMatch(provider, /console\.(log|info|debug)\([^)]*password/i)

const settings = readFileSync(join(root, 'src/pages/AdminSettingsPage.tsx'), 'utf8')
assert.match(settings, /Sigurnost administratorskog računa/)
assert.match(settings, /AdminPasswordChangeForm/)

const login = readFileSync(join(root, 'src/pages/AdminLoginPage.tsx'), 'utf8')
assert.match(login, /Zaboravljena lozinka/)

const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
assert.match(app, /AdminForgotPasswordPage/)
assert.match(app, /AdminResetPasswordPage/)
assert.match(app, /AdminAuthCallbackRedirect/)
assert.match(app, /admin\/forgot-password/)
assert.match(app, /admin\/reset-password/)

const docs = readFileSync(join(root, 'docs/admin-password-management.md'), 'utf8')
assert.match(docs, /Redirect URLs/)
assert.match(docs, /anislrc\.hr\/admin\/reset-password/)
assert.match(docs, /otp_expired/)

assert.equal(ADMIN_PASSWORD_RECOVERY_PATH, '/admin/reset-password')

console.log('test-admin-password: PASS')
