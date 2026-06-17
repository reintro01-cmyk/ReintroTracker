import { useMemo, useState } from "react";
import { X, Copy, Check, Share2, ImageDown } from "lucide-react";
import { buildLogShareText, groupLogsByMeal, formatShareDate, portionText } from "../../utils/logShare.js";

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Render the day's log to a PNG data URL via canvas — no extra dependency, so the user can save
// a snapshot to attach in chat. Layout is a simple stacked list; quantities are right-aligned.
function renderLogImage({ groups, dateStr, totalKcal }) {
  const scale = 2, W = 560, PAD = 36;
  const rows = [{ kind: "title", h: 34 }, { kind: "date", h: 26, text: dateStr }];
  for (const g of groups) {
    rows.push({ kind: "gap", h: 16 }, { kind: "meal", h: 26, text: cap(g.meal) });
    for (const l of g.items) rows.push({ kind: "item", h: 24, name: l.custom_name, qty: portionText(l) });
  }
  if (totalKcal != null && totalKcal > 0) rows.push({ kind: "gap", h: 18 }, { kind: "total", h: 28, text: `Total: ${Math.round(totalKcal)} kcal` });

  const H = PAD * 2 + rows.reduce((s, r) => s + r.h, 0);
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(0, 0, 6, H);
  ctx.textBaseline = "alphabetic";

  let y = PAD;
  for (const r of rows) {
    if (r.kind === "title") {
      ctx.fillStyle = "#0f172a"; ctx.font = "700 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("🍽️ Food log", PAD, y + 22);
    } else if (r.kind === "date") {
      ctx.fillStyle = "#64748b"; ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(r.text, PAD, y + 16);
    } else if (r.kind === "meal") {
      ctx.fillStyle = "#4338ca"; ctx.font = "700 15px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(r.text.toUpperCase(), PAD, y + 18);
    } else if (r.kind === "item") {
      ctx.fillStyle = "#334155"; ctx.font = "400 15px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`•  ${r.name}`, PAD + 6, y + 16);
      if (r.qty) {
        ctx.fillStyle = "#64748b"; ctx.textAlign = "right";
        ctx.fillText(r.qty, W - PAD, y + 16); ctx.textAlign = "left";
      }
    } else if (r.kind === "total") {
      ctx.fillStyle = "#0f172a"; ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(r.text, PAD, y + 18);
    }
    y += r.h;
  }
  return canvas.toDataURL("image/png");
}

// Ephemeral share sheet for ONE day's log. Closing it dismisses it — nothing is persisted.
export function ShareLogModal({ logs, date, totalKcal, onClose }) {
  const [copied, setCopied] = useState(false);
  const groups = useMemo(() => groupLogsByMeal(logs), [logs]);
  const text = useMemo(() => buildLogShareText({ logs, dateIso: date, totalKcal }), [logs, date, totalKcal]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — user can still select the text */ }
  }

  async function share() {
    try { await navigator.share({ text }); } catch { /* dismissed/unsupported */ }
  }

  function saveImage() {
    const a = document.createElement("a");
    a.href = renderLogImage({ groups, dateStr: formatShareDate(date), totalKcal });
    a.download = `food-log-${date}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Share this day’s log</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed">{text}</pre>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
          <button onClick={saveImage} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
            <ImageDown size={15} /> Save image
          </button>
          {canShare && (
            <button onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
              <Share2 size={15} /> Share
            </button>
          )}
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all">
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      </div>
    </div>
  );
}
