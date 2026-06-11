import { useState } from "react";
import { Button } from "./ui.jsx";
import { Sparkles, UserCircle2, Mail } from "lucide-react";

export function AuthLanding({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  message,
  rememberedEmails,
  onSubmit,
  onForgotPassword,
  onContinueAsGuest,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = email
    ? rememberedEmails.filter(e => e.toLowerCase().includes(email.toLowerCase()) && e.toLowerCase() !== email.toLowerCase())
    : rememberedEmails;

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-indigo-50 via-white to-violet-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg mb-4">
              <Sparkles size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Reintroduction Tracker</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to sync across devices, or jump right in as a guest.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100" role="group" aria-label="Auth mode">
              {[
                { key: "signIn", label: "Sign in" },
                { key: "signUp", label: "Create account" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onModeChange(key)}
                  aria-pressed={mode === key}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    mode === key
                      ? "bg-white text-indigo-700 border-b-2 border-indigo-600"
                      : "bg-slate-50 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="landing-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="landing-email"
                    type="email"
                    value={email}
                    onChange={e => onEmailChange(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    list="remembered-emails"
                    required
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                  />
                  <datalist id="remembered-emails">
                    {rememberedEmails.map(e => <option key={e} value={e} />)}
                  </datalist>

                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map(e => (
                        <li key={e}>
                          <button
                            type="button"
                            onMouseDown={ev => { ev.preventDefault(); onEmailChange(e); setShowSuggestions(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none flex items-center gap-2"
                          >
                            <UserCircle2 size={14} className="text-slate-500 shrink-0" />
                            <span className="truncate">{e}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="landing-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Password
                </label>
                <input
                  id="landing-password"
                  type="password"
                  value={password}
                  onChange={e => onPasswordChange(e.target.value)}
                  placeholder={mode === "signUp" ? "Choose a password (min 6 characters)" : "Your password"}
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                />
                {mode === "signIn" && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg">
                {mode === "signUp" ? "Create account" : "Sign in"}
              </Button>

              {message && (
                <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</p>
              )}
            </form>

            <div className="px-6 pb-6">
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500 font-semibold tracking-wider">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={onContinueAsGuest}
              >
                <UserCircle2 size={16} className="mr-2" />
                Continue as guest
              </Button>
              <p className="text-[11px] text-slate-500 text-center mt-3 leading-relaxed">
                Guest mode keeps everything on this device. You can sign in later from Settings to back up your data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
