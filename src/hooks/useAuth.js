import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const EMAIL_HISTORY_KEY = "reintroduction_tracker_email_history";
const GUEST_MODE_KEY = "reintroduction_tracker_guest_mode";
const MAX_REMEMBERED_EMAILS = 6;

function loadRememberedEmails() {
  try {
    const raw = localStorage.getItem(EMAIL_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(e => typeof e === "string") : [];
  } catch { return []; }
}

function rememberEmail(email) {
  if (!email) return loadRememberedEmails();
  const clean = email.trim().toLowerCase();
  const current = loadRememberedEmails().filter(e => e.toLowerCase() !== clean);
  const next = [email.trim(), ...current].slice(0, MAX_REMEMBERED_EMAILS);
  try { localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function useAuth({ showToast }) {
  const [session, setSession] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("signIn");
  const [authMessage, setAuthMessage] = useState("");
  // Set when a signup needs email confirmation, so the UI can show a prominent
  // "check your email" state instead of just a small toast.
  const [signUpPendingEmail, setSignUpPendingEmail] = useState("");
  const [rememberedEmails, setRememberedEmails] = useState(() => loadRememberedEmails());
  const [guestMode, setGuestMode] = useState(() => {
    try { return localStorage.getItem(GUEST_MODE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setSession(nextSession || null);
        setShowPasswordReset(true);
        return;
      }
      setSession(nextSession || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleEmailPasswordAuth(e) {
    e.preventDefault();
    setAuthMessage(authMode === "signUp" ? "Creating account…" : "Signing in…");
    const authCall = authMode === "signUp"
      // Always pass emailRedirectTo so the confirmation link uses the current origin —
      // doesn't depend on a correctly-configured Supabase Site URL.
      ? supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        })
      : supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    const { data, error } = await authCall;
    if (error) { setAuthMessage(error.message); return; }
    setRememberedEmails(rememberEmail(authEmail));
    if (authMode === "signUp" && !data.session) {
      setSignUpPendingEmail(authEmail);
      setAuthMessage("");
      setAuthPassword("");
      return;
    }
    setAuthPassword("");
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
    setGuestMode(false);
    setAuthMessage(authMode === "signUp" ? "Account created and signed in." : "Signed in.");
  }

  async function resendSignUpConfirmation() {
    if (!signUpPendingEmail) return;
    setAuthMessage("Resending email…");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: signUpPendingEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthMessage(error ? error.message : "Confirmation email re-sent.");
  }

  function dismissSignUpPending() {
    setSignUpPendingEmail("");
    setAuthMessage("");
    setAuthMode("signIn");
  }

  function continueAsGuest() {
    try { localStorage.setItem(GUEST_MODE_KEY, "1"); } catch {}
    setGuestMode(true);
  }

  async function handleSetNewPassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setShowPasswordReset(false);
    showToast("Password updated — you're now signed in.");
    return null;
  }

  async function handleForgotPassword() {
    if (!authEmail) { setAuthMessage("Enter your email address first."); return; }
    setAuthMessage("Sending reset email…");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin,
    });
    setAuthMessage(error ? error.message : "Password reset email sent — check your inbox.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
    setGuestMode(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMessage("");
    setAuthMode("signIn");
  }

  function exitGuestMode() {
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
    setGuestMode(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMessage("");
    setAuthMode("signIn");
  }

  return {
    session, showPasswordReset,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authMode, setAuthMode,
    authMessage,
    rememberedEmails,
    guestMode,
    handleEmailPasswordAuth,
    handleForgotPassword,
    handleSetNewPassword,
    signOut,
    exitGuestMode,
    continueAsGuest,
    signUpPendingEmail,
    resendSignUpConfirmation,
    dismissSignUpPending,
  };
}
