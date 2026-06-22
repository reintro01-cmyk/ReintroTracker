import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { ShellChrome, StageNote } from "../ShellChrome.jsx";
import { Users, UserPlus, Mail, Loader2, Activity } from "lucide-react";

const STAFF_ROLES = ["clinician", "follower", "observer", "admin"];

// Admin = build the hierarchy + oversight. Stage 1 delivers the hierarchy builder: invite staff,
// add patients. Monitoring of clinician activity + all-patient access arrives in Stage 4.
export function AdminShell({ auth, identity, showToast }) {
  const clinic = identity.primaryMembership;
  const clinicId = clinic.clinic_id;
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [patients, setPatients] = useState([]);
  const [mEmail, setMEmail] = useState("");
  const [mRole, setMRole] = useState("clinician");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i, p] = await Promise.all([
      supabase.from("clinic_members").select("id,user_id,role,created_at").eq("clinic_id", clinicId),
      supabase.from("clinic_invites").select("id,email,role").eq("clinic_id", clinicId),
      supabase.from("patients").select("id,display_name,invite_email,status").eq("clinic_id", clinicId).order("created_at", { ascending: false }),
    ]);
    setMembers(m.data || []); setInvites(i.data || []); setPatients(p.data || []);
  }, [clinicId]);
  useEffect(() => { load(); }, [load]);

  async function inviteMember() {
    if (!mEmail.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("clinic_invites")
      .insert({ clinic_id: clinicId, email: mEmail.trim().toLowerCase(), role: mRole, invited_by: auth.session.user.id });
    setBusy(false);
    if (error) return showToast(error.message, "error");
    setMEmail(""); showToast("Staff invited ✓"); load();
  }

  async function addPatient() {
    if (!pName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("patients")
      .insert({ clinic_id: clinicId, display_name: pName.trim(), invite_email: pEmail.trim().toLowerCase() || null, created_by: auth.session.user.id });
    setBusy(false);
    if (error) return showToast(error.message, "error");
    setPName(""); setPEmail(""); showToast("Patient added ✓"); load();
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400";

  return (
    <ShellChrome clinicName={clinic.clinic_name} role="admin" email={auth.session?.user?.email} onSignOut={auth.signOut}>
      <h1 className="text-xl font-bold text-slate-900 mb-5">Clinic administration</h1>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Team */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users size={16} className="text-violet-500" />
            <h2 className="font-bold text-sm text-slate-800">Team</h2>
            <span className="text-xs text-slate-400">({members.length})</span>
          </div>
          <div className="p-5 space-y-3">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-mono text-xs truncate">{m.user_id.slice(0, 8)}…</span>
                <span className="text-xs font-semibold text-slate-500 capitalize">{m.role}</span>
              </div>
            ))}
            {invites.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 truncate flex items-center gap-1.5"><Mail size={12} className="text-amber-500" />{i.email}</span>
                <span className="text-xs font-semibold text-amber-600 capitalize">{i.role} · pending</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row gap-2">
              <input value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="staff@email.com" type="email" className={inputCls} />
              <select value={mRole} onChange={e => setMRole(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm capitalize">
                {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={inviteMember} disabled={busy || !mEmail.trim()}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                <UserPlus size={14} /> Invite
              </button>
            </div>
          </div>
        </section>

        {/* Patients */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            <h2 className="font-bold text-sm text-slate-800">Patients</h2>
            <span className="text-xs text-slate-400">({patients.length})</span>
          </div>
          <div className="p-5 space-y-3">
            {patients.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 truncate">{p.display_name}</span>
                <span className="text-xs font-semibold text-slate-400">{p.status}</span>
              </div>
            ))}
            {patients.length === 0 && <p className="text-xs text-slate-400">No patients yet.</p>}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Patient name" className={inputCls} />
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="patient@email.com (optional)" type="email" className={inputCls} />
                <button onClick={addPatient} disabled={busy || !pName.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5">
        <StageNote>Clinician-activity monitoring and all-patient drill-down arrive in Stage 4.</StageNote>
      </div>
    </ShellChrome>
  );
}
