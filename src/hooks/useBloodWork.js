import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { edgeErrorMessage } from "../utils/edgeError.js";

// Blood-work data layer (personal app). Stores the raw file in the private `bloodwork` bucket
// (owner-scoped by an "<uid>/…" path prefix) and an AI summary in the blood_work table. Upload
// flow: store file → insert row (processing) → summarise via edge function → update row.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useBloodWork(session) {
  const userId = session?.user?.id || null;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setReports([]); return; }
    setLoading(true);
    const { data } = await supabase.from("blood_work").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (file, reportDate) => {
    if (!userId) return { error: "Sign in to upload blood work." };
    if (!file) return { error: "Choose a file first." };
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("bloodwork").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return { error: upErr.message };

      const { data: row, error: insErr } = await supabase.from("blood_work")
        .insert({ user_id: userId, file_path: path, file_name: file.name, report_date: reportDate || null, status: "processing" })
        .select().single();
      if (insErr) { await supabase.storage.from("bloodwork").remove([path]); return { error: insErr.message }; }

      await load();

      const base64 = await fileToBase64(file);
      const { data: ai, error: fnErr } = await supabase.functions.invoke("summarise-bloodwork", {
        body: { file_base64: base64, media_type: file.type },
      });
      if (fnErr || !ai?.summary) {
        await supabase.from("blood_work").update({ status: "error" }).eq("id", row.id);
        await load();
        return { error: fnErr ? await edgeErrorMessage(fnErr) : "Could not summarise the report." };
      }
      await supabase.from("blood_work").update({ status: "done", summary: ai.summary, flags: ai.flags || [] }).eq("id", row.id);
      await load();
      return { error: null };
    } finally {
      setBusy(false);
    }
  }, [userId, load]);

  const remove = useCallback(async (report) => {
    await supabase.storage.from("bloodwork").remove([report.file_path]);
    await supabase.from("blood_work").delete().eq("id", report.id);
    await load();
  }, [load]);

  const viewUrl = useCallback(async (report) => {
    const { data } = await supabase.storage.from("bloodwork").createSignedUrl(report.file_path, 300);
    return data?.signedUrl || null;
  }, []);

  return { reports, loading, busy, upload, remove, viewUrl, reload: load };
}
