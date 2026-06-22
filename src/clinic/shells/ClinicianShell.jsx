import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ShellChrome, StageNote } from "../ShellChrome.jsx";
import { Activity } from "lucide-react";

// Non-admin staff (clinician / follower / observer). Stage 1 shows the patient roster so routing
// and clinic-scoped reads are proven. Assigning schedules, observation days, calorie goals (Stage
// 2) and water/vitamin monitoring (Stage 4) build on top of this.
export function ClinicianShell({ auth, identity }) {
  const clinic = identity.primaryMembership;
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    supabase.from("patients").select("id,display_name,status")
      .eq("clinic_id", clinic.clinic_id).order("created_at", { ascending: false })
      .then(({ data }) => setPatients(data || []));
  }, [clinic.clinic_id]);

  return (
    <ShellChrome clinicName={clinic.clinic_name} role={clinic.role} email={auth.session?.user?.email} onSignOut={auth.signOut}>
      <h1 className="text-xl font-bold text-slate-900 mb-5">Your patients</h1>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity size={16} className="text-indigo-500" />
          <h2 className="font-bold text-sm text-slate-800">Roster</h2>
          <span className="text-xs text-slate-400">({patients.length})</span>
        </div>
        <div className="divide-y divide-slate-50">
          {patients.map(p => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{p.display_name}</span>
              <span className="text-xs font-semibold text-slate-400">{p.status}</span>
            </div>
          ))}
          {patients.length === 0 && <p className="px-5 py-4 text-sm text-slate-400">No patients assigned to this clinic yet.</p>}
        </div>
      </section>

      <StageNote>Assigning a food schedule, observation days, and a calorie goal per patient arrives in Stage 2.</StageNote>
    </ShellChrome>
  );
}
