import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Building2, RefreshCw, LogOut, Loader2 } from "lucide-react";

// Shown to a signed-in user who belongs to no clinic and has no patient record. Two paths:
// stand up a new clinic (and become its admin), or wait for an invite to the current email.
export function Bootstrap({ auth, identity, showToast }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const email = auth.session?.user?.email;

  async function createClinic() {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_clinic", { p_name: name.trim() });
    setBusy(false);
    if (error) return showToast(error.message, "error");
    showToast("Clinic created ✓");
    identity.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white mb-3">
            <Building2 size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Set up your clinic</h1>
          <p className="text-sm text-slate-500 mt-1">Signed in as <span className="font-medium text-slate-700">{email}</span> — not part of a clinic yet.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="text-sm font-semibold text-slate-800">Create a clinic</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Clinic name"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          <button onClick={createClinic} disabled={!name.trim() || busy}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition-all">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} Create &amp; become admin
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="text-sm font-semibold text-slate-800">Been invited?</div>
          <p className="text-xs text-slate-500">Ask your clinic to invite <span className="font-medium text-slate-700">{email}</span>, then refresh.</p>
          <div className="flex gap-2">
            <button onClick={identity.refresh}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={auth.signOut}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
