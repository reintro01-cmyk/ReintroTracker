import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Resolves who the signed-in user is in the clinic system, so ClinicApp can pick a shell.
// On every login it first calls claim_invites() (links any pending email invites to this account),
// then my_identity() (their memberships + patient records). Idempotent and cheap.
const ROLE_RANK = { admin: 0, clinician: 1, follower: 2, observer: 3 };

export function useClinicIdentity(session) {
  const userId = session?.user?.id || null;
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [patients, setPatients] = useState([]);

  const resolve = useCallback(async () => {
    if (!userId) { setMemberships([]); setPatients([]); setLoading(false); return; }
    setLoading(true);
    // If the user arrived via a share link (?token=…), redeem it before resolving identity.
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      await supabase.rpc("claim_invite", { p_token: token });
      params.delete("token");
      window.history.replaceState({}, "", window.location.pathname + (params.toString() ? `?${params}` : ""));
    }
    const { data } = await supabase.rpc("my_identity");
    setMemberships(data?.memberships || []);
    setPatients(data?.patients || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { resolve(); }, [resolve]);

  const primaryMembership = [...memberships]
    .sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9))[0] || null;

  return {
    loading,
    memberships,
    patients,
    primaryMembership,
    isStaff: memberships.length > 0,
    isAdmin: memberships.some(m => m.role === "admin"),
    isPatient: patients.length > 0,
    refresh: resolve,
  };
}
