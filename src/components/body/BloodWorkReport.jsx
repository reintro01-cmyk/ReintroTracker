import { useRef, useState } from "react";
import { useBloodWork } from "../../hooks/useBloodWork.js";
import { Upload, Loader2, FileText, Trash2, ExternalLink, AlertTriangle } from "lucide-react";

const ACCEPT = ".pdf,image/jpeg,image/png,image/webp";
const niceDate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

export function BloodWorkReport({ session }) {
  const { reports, loading, busy, upload, remove, viewUrl } = useBloodWork(session);
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [reportDate, setReportDate] = useState("");
  const [msg, setMsg] = useState("");

  if (!session) {
    return <p className="text-sm text-slate-500">Sign in to upload and summarise your blood work.</p>;
  }

  async function handleUpload() {
    setMsg("");
    const res = await upload(file, reportDate);
    if (res.error) { setMsg(res.error); return; }
    setFile(null); setReportDate("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openFile(report) {
    const url = await viewUrl(report);
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 text-xs font-semibold text-slate-600">
            Report file (PDF or image)
            <input ref={fileRef} type="file" accept={ACCEPT}
              onChange={e => { setFile(e.target.files?.[0] || null); setMsg(""); }}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Report date
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
          </label>
          <button onClick={handleUpload} disabled={!file || busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition-all">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Summarising…" : "Upload"}
          </button>
        </div>
        {msg && <p className="text-xs text-rose-600">{msg}</p>}
        <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          AI summaries are for understanding only — not medical advice. Always review results with your doctor.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-500">No reports yet. Upload a lab report to get a plain-language summary.</p>
      ) : (
        <div className="space-y-2.5">
          {reports.map(r => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileText size={14} className="text-indigo-500 shrink-0" />
                    <span className="truncate">{r.file_name || "Report"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {niceDate(r.report_date) || new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {r.status === "processing" && " · summarising…"}
                    {r.status === "error" && " · summary failed"}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openFile(r)} aria-label="Open file" title="Open file"
                    className="text-slate-400 hover:text-indigo-600 inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg hover:bg-slate-100">
                    <ExternalLink size={14} />
                  </button>
                  <button onClick={() => remove(r)} aria-label="Delete report" title="Delete"
                    className="text-slate-400 hover:text-rose-600 inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg hover:bg-slate-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {Array.isArray(r.flags) && r.flags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {r.flags.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] text-amber-800">
                      <span className="font-semibold">{f.label}</span>
                      {f.value && <span className="text-amber-600">{f.value}</span>}
                    </span>
                  ))}
                </div>
              )}

              {r.summary && (
                <p className="mt-2.5 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{r.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
