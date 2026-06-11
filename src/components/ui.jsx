export function Card({ className = "", children }) {
  return (
    <div className={`bg-white border border-slate-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

export function Button({
  className = "",
  variant = "default",
  size = "default",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 border disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1";

  const variants = {
    default: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 active:scale-95",
    outline: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95",
    ghost:   "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 active:scale-95",
    danger:  "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 active:scale-95",
  };

  const sizes = {
    default: "px-4 py-2 text-sm",
    sm:      "px-2.5 py-1.5 text-xs",
    lg:      "px-5 py-2.5 text-base",
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
