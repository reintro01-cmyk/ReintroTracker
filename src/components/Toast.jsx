export function Toast({ message, type = "success" }) {
  const cls = type === "error"
    ? "bg-rose-700"
    : type === "warning"
    ? "bg-amber-600"
    : "bg-emerald-700";
  return (
    <div role="status" aria-live="polite" className={`fixed top-4 right-4 z-[100] ${cls} text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg animate-slideDown`}>
      {message}
    </div>
  );
}
