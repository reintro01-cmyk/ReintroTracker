import { useState } from "react";
import { Button } from "./ui.jsx";

export function PasswordResetModal({ onSubmit }) {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) { setMessage("Passwords don't match."); return; }
    if (newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    setMessage("Updating password…");
    const err = await onSubmit(newPassword);
    if (err) setMessage(err);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-reset-title"
      className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4"
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-0.5">Account</div>
          <h2 id="pwd-reset-title" className="text-xl font-bold text-white">Set new password</h2>
          <p className="text-sm text-white/70 mt-0.5">Choose a new password for your account.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="new-pwd" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">New password</label>
            <input
              id="new-pwd"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              minLength={6}
              required
              autoFocus
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="new-pwd-confirm" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Confirm password</label>
            <input
              id="new-pwd-confirm"
              type="password"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              placeholder="Repeat new password"
              minLength={6}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            />
          </div>
          {message && <p className="text-xs text-slate-500">{message}</p>}
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <Button type="submit" className="flex-1">Update password</Button>
        </div>
      </form>
    </div>
  );
}
