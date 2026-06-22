import { ShellChrome, StageNote } from "../ShellChrome.jsx";
import { Utensils } from "lucide-react";

// The end-user (patient). Stage 1 confirms they're routed here and linked to their clinic. The
// "what can I eat today" plan, tap-to-confirm meals, observations, and recipes arrive in Stage 3.
export function PatientShell({ auth, identity }) {
  const p = identity.patients[0];

  return (
    <ShellChrome clinicName={p?.clinic_name} role="patient" email={auth.session?.user?.email} onSignOut={auth.signOut}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Utensils size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Hi {p?.display_name || "there"}</h1>
            <p className="text-sm text-slate-500">
              You're enrolled at <span className="font-medium text-slate-700">{p?.clinic_name || "your clinic"}</span> · {p?.status}
            </p>
          </div>
        </div>
      </div>

      <StageNote>Your daily plan — what you can eat today, tap-to-confirm meals, observations, and recipes — arrives in Stage 3.</StageNote>
    </ShellChrome>
  );
}
