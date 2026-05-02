import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-400">{icon}</span>
        <span className="text-2xl font-black tracking-tight text-slate-50">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">{label}</p>
    </div>
  );
}
