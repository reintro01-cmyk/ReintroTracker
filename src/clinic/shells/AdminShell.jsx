import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { ShellChrome, StageNote } from "../ShellChrome.jsx";
import { Users, UserPlus, Mail, Loader2, Activity, Check, Copy, Link as LinkIcon } from "lucide-react";

const STAFF_ROLES = ["account_manager", "doctor", "dietician", "admin"];
const roleLabel = r => ({ account_manager: "Account manager", doctor: "Doctor", dietician: "Dietician", admin: "Admin" }[r] || r);
const inviteLink = token => `${window.location.origin}/?token=${token}`;

// Admin = build the hierarchy + approve enrollments. Staff/patients onboard via shareable links.
export function AdminShell({ auth, identity, showToast }) {
  const clinic = identity.primaryMembership;
  const clinicId = clinic.clinic_id;
  const [members, setMembers] = useState([]);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [patients, setPatients] = useState([]);
  const [mEmail, setMEmail] = useState("");
  const [mRole, setMRole] = useState("account_manager");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState({});   // id → invite URL just generated

  const load = useCallback(async () => {
    const [m, inv, p] = await Promise.all([
      supabase.from("clinic_members").select("id,user_id,role").eq("clinic_id", clinicId),
      supabase.from("invites").select("token,email,role,used_at").eq("clinic_id", clinicId).eq("kind", "staff").is("used_at", null),
      supabase.from("patients").select("id,display_name,status").eq("clinic_id", clinicId).order("created_at", { ascending: false }),
    ]);
    setMembers(m.data || []); setPendingStaff(inv.data || []); setPatients(p.data || []);
  }, [clinicId]);
  useEffect(() => { load(); }, [load]);

  async function copyLink(id, url) {
    setLinks(s => ({ ...s, [id]: url }));
    try { await navigator.clipboard.writeText(url); showToast("Invite link copied ✓"); } catch { showToast("Link ready — copy it below"); }
  }

  async function inviteStaff() {
    if (!mEmail.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_staff_invite", { p_clinic_id: clinicId, p_email: mEmail.trim(), p_role: mRole });
    setBusy(false);
    if (error) return showToast(error.message, "error");
    setMEmail(""); await load();
    copyLink(`staff:${data}`, inviteLink(data));
  }

  async function enroll() {
    if (!pName.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("enroll_patient", { p_clinic_id: clinicId, p_display_name: pName.trim(), p_email: pEmail.trim() || null });
    setBusy(false);
    if (error) return showToast(error.message, "error");
    setPName(""); setPEmail(""); showToast("Patient enrolled — pending your approval"); load();
  }

  async function approve(id) {
    const { error } = await supabase.rpc("approve_patient", { p_patient_id: id });
    if (error) return showToast(error.message, "error");
    showToast("Approved ✓"); load();
  }

  async function patientLink(id) {
    const { data, error } = await supabase.rpc("create_patient_invite", { p_patient_id: id });
    if (error) return showToast(error.message, "error");
    copyLink(`pat:${id}`, inviteLink(data));
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400";
  const LinkRow = ({ url }) => url ? (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1">
      <LinkIcon size={11} className="shrink-0" /><span className="truncate">{url}</span>
    </div>
  ) : null;

  return (
    <ShellChrome clinicName={clinic.clinic_name} role="admin" email={auth.session?.user?.email} onSignOut={auth.signOut}>
      <h1 className="text-xl font-bold text-slate-900 mb-5">Clinic administration</h1>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Team */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users size={16} className="text-violet-500" /><h2 className="font-bold text-sm text-slate-800">Team</h2>
            <span className="text-xs text-slate-400">({members.length})</span>
          </div>
          <div className="p-5 space-y-2.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-mono text-xs truncate">{m.user_id.slice(0, 8)}…</span>
                <span className="text-xs font-semibold text-slate-500">{roleLabel(m.role)}</span>
              </div>
            ))}
            {pendingStaff.map(i => (
              <div key={i.token}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate flex items-center gap-1.5"><Mail size={12} className="text-amber-500" />{i.email || "(link)"}</span>
                  <button onClick={() => copyLink(`staff:${i.token}`, inviteLink(i.token))} className="text-xs font-semibold text-amber-600 inline-flex items-center gap-1">
                    {roleLabel(i.role)} · <Copy size={11} /> link
                  </button>
                </div>
                <LinkRow url={links[`staff:${i.token}`]} />
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row gap-2">
              <input value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="staff@email.com" type="email" className={inputCls} />
              <select value={mRole} onChange={e => setMRole(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                {STAFF_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <button onClick={inviteStaff} disabled={busy || !mEmail.trim()}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                <UserPlus size={14} /> Invite
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Invite generates a link — share it with the person (e.g. WhatsApp). They set a password on opening it.</p>
          </div>
        </section>

        {/* Patients */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" /><h2 className="font-bold text-sm text-slate-800">Patients</h2>
            <span className="text-xs text-slate-400">({patients.length})</span>
          </div>
          <div className="p-5 space-y-2.5">
            {patients.map(p => (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700 truncate">{p.display_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "pending_approval" ? (
                      <button onClick={() => approve(p.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-700">
                        <Check size={12} /> Approve
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">{p.status}</span>
                    )}
                    {p.status === "active" && (
                      <button onClick={() => patientLink(p.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        <Copy size={11} /> Invite link
                      </button>
                    )}
                  </div>
                </div>
                <LinkRow url={links[`pat:${p.id}`]} />
              </div>
            ))}
            {patients.length === 0 && <p className="text-xs text-slate-400">No patients yet.</p>}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Patient name" className={inputCls} />
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="patient@email.com (optional now)" type="email" className={inputCls} />
                <button onClick={enroll} disabled={busy || !pName.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Enroll
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5">
        <StageNote>Care-team assignment (add a doctor/dietician to a patient), notifications, and the staff drill-down come next.</StageNote>
      </div>
    </ShellChrome>
  );
}
