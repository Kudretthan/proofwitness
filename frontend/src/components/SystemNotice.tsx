import type { ReactNode } from "react";

export default function SystemNotice({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: ReactNode;
  tone?: "slate" | "amber" | "red" | "violet";
}) {
  const tones = {
    slate: "border-slate-700/60 bg-slate-900/65 text-slate-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    red: "border-red-400/25 bg-red-500/10 text-red-100",
    violet: "border-violet-400/25 bg-violet-500/10 text-violet-100",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-1 text-sm leading-relaxed opacity-85">{children}</div>
    </div>
  );
}
