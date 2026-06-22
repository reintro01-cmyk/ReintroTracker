import { LogOut } from "lucide-react";

// Shared top bar for every clinic shell: clinic name, role badge, sign out.
const ROLE_LABEL = { admin: "Admin", clinician: "Clinician", follower: "Follower", observer: "Observer", patient: "Patient" };
const ROLE_TONE = {
  admin: "bg-violet-100 text-violet-700",
  clinician: "bg-indigo-100 text-indigo-700",
  follower: "bg-sky-100 text-sky-700",
  observer: "bg-slate-100 text-slate-600",
  patient: "bg-emerald-100 text-emerald-700",
};

export function ShellChrome({ clinicName, role, email, onSignOut, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 h-14 flex items-center px-4 md:px-6 gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900 truncate">{clinicName || "Clinic"}</div>
          <div className="text-[11px] text-slate-500 truncate">{email}</div>
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg ${ROLE_TONE[role] || ROLE_TONE.observer}`}>
          {ROLE_LABEL[role] || role}
        </span>
        <button onClick={onSignOut} aria-label="Sign out"
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <LogOut size={16} />
        </button>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export function StageNote({ children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}
