import { useRef, useEffect } from "react";
import { Button } from "./ui.jsx";
import { Download, Upload, RotateCcw, X } from "lucide-react";

export function SettingsDrawer({
  isOpen, onClose,
  session, syncStatus, guestMode,
  authMode, authEmail, authPassword, authMessage, rememberedEmails,
  userName,
  onAuthModeChange, onEmailChange, onPasswordChange,
  onSubmit, onForgotPassword,
  onSignOut, onExitGuestMode,
  onNameChange,
  onExportJson, onExportCsv, onImportJson, onReset,
}) {
  const drawerRef = useRef(null);

  // Focus the first focusable element only when the drawer opens.
  // Kept separate from the keyboard handler so it doesn't re-run on every
  // render (which would steal focus from inputs on each keystroke).
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
  }, [isOpen]);

  // Keyboard trap — re-registers when onClose changes but never steals focus.
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    function handler(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 shrink-0">
          <span id="settings-title" className="font-bold text-slate-900">Settings</span>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Account / Auth */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-0.5">Account</div>
              <h2 className="font-bold text-base text-indigo-900">
                {session?.user ? "Signed in" : "Sign in to sync"}
              </h2>
            </div>
            {session?.user ? (
              <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{session.user.email}</div>
                  <div className={`text-xs mt-0.5 ${syncStatus.includes("✓") ? "text-emerald-600" : "text-slate-500"}`}>{syncStatus}</div>
                </div>
                <Button variant="outline" size="sm" onClick={onSignOut}>Sign out</Button>
              </div>
            ) : (
              <div className="px-5 py-5">
                {guestMode && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-amber-800 leading-relaxed">
                      You're using <b>guest mode</b>. Data is only on this device.
                    </div>
                    <Button variant="outline" size="sm" onClick={onExitGuestMode} className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100">
                      Sign out
                    </Button>
                  </div>
                )}
                <p className="text-sm text-slate-500 mb-4">Sign in to sync your data across devices.</p>
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="flex gap-2" role="group" aria-label="Auth mode">
                    {["signIn", "signUp"].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onAuthModeChange(mode)}
                        aria-pressed={authMode === mode}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                          authMode === mode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {mode === "signIn" ? "Sign in" : "Create account"}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="auth-email" className="sr-only">Email address</label>
                  <input
                    id="auth-email"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                    type="email" value={authEmail} onChange={e => onEmailChange(e.target.value)}
                    placeholder="Email address" required
                    autoComplete="email"
                    list="settings-remembered-emails"
                  />
                  <datalist id="settings-remembered-emails">
                    {rememberedEmails.map(e => <option key={e} value={e} />)}
                  </datalist>
                  <div>
                    <label htmlFor="auth-password" className="sr-only">Password</label>
                    <input
                      id="auth-password"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                      type="password" value={authPassword} onChange={e => onPasswordChange(e.target.value)}
                      placeholder="Password (min 6 characters)" minLength={6} required
                    />
                    {authMode === "signIn" && (
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Button type="submit" className="w-full">
                    {authMode === "signUp" ? "Create account" : "Sign in"}
                  </Button>
                  {authMessage && <p className="text-xs text-slate-500">{authMessage}</p>}
                </form>
              </div>
            )}
          </div>

          {/* Display name */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-violet-50 border-b border-violet-100 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-violet-600 mb-0.5">You</div>
              <h2 className="font-bold text-base text-violet-900">Your name</h2>
            </div>
            <div className="px-5 py-4">
              <label htmlFor="display-name" className="text-xs font-semibold text-slate-600 block mb-1.5">
                Display name <span className="font-normal text-slate-500">(shown in the header)</span>
              </label>
              <input
                id="display-name"
                type="text"
                value={userName}
                onChange={e => onNameChange(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.30)] transition-shadow"
              />
            </div>
          </div>

          {/* Data management */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Data</div>
              <h2 className="font-bold text-base text-slate-800">Data management</h2>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onExportJson}>
                <Download size={13} className="mr-1.5" />Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={onExportCsv}>
                <Download size={13} className="mr-1.5" />Export CSV
              </Button>
              <label className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all">
                <Upload size={13} className="mr-1.5" />Import backup
                <input type="file" accept="application/json" className="hidden" onChange={e => onImportJson(e.target.files?.[0])} />
              </label>
              <Button variant="outline" size="sm" onClick={onReset} className="text-rose-600 border-rose-200 hover:border-rose-300">
                <RotateCcw size={13} className="mr-1.5" />Reset all data
              </Button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
