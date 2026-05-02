import { Link } from "react-router-dom";
import { Bot, CheckCircle2, Clock, Coins, Award, FileCheck2, Users, XCircle, ArrowRight } from "lucide-react";
import StatCard from "../components/StatCard";
import SystemNotice from "../components/SystemNotice";
import type { Claim } from "../types";

type Props = {
  stats: any;
  walletConnected: boolean;
  stakeMode: "soroban" | "treasury";
  sorobanConfigErr: string | null;
  recentClaims: Claim[];
};

export default function DashboardPage({ stats, walletConnected, stakeMode, sorobanConfigErr, recentClaims }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-50">Genel Bakış</h1>
        <p className="mt-2 text-slate-400">
          ProofWitness, kriz iddialarını AI, insan doğrulaması, XLM stake ve Soroban escrow ile değerlendirir.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Bildirim" value={stats.totalClaims} icon={<FileCheck2 className="h-5 w-5" />} tone="border-indigo-400/20 bg-indigo-500/10" />
        <StatCard label="Aktif Bildirim" value={stats.needsEvidence} icon={<Clock className="h-5 w-5" />} tone="border-amber-400/20 bg-amber-500/10" />
        <StatCard label="Doğrulanan" value={stats.verified} icon={<CheckCircle2 className="h-5 w-5" />} tone="border-emerald-400/20 bg-emerald-500/10" />
        <StatCard label="Yanlışlanan" value={stats.disputed} icon={<XCircle className="h-5 w-5" />} tone="border-red-400/20 bg-red-500/10" />
        <StatCard label="Toplam Doğrulama" value={stats.totalVerifications} icon={<Users className="h-5 w-5" />} tone="border-cyan-400/20 bg-cyan-500/10" />
        <StatCard label="Toplam Stake (XLM)" value={stats.totalStaked} icon={<Coins className="h-5 w-5" />} tone="border-violet-400/20 bg-violet-500/10" />
        <StatCard label="İtibar Kredisi" value={stats.distributedCredits} icon={<Award className="h-5 w-5" />} tone="border-sky-400/20 bg-sky-500/10" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="section-card p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-100">Sistem Durumu</h2>
          <div className="space-y-3 text-sm">
             <div className="flex justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
               <span className="text-slate-400">Cüzdan Bağlantısı</span>
               <span className="font-bold text-slate-100">{walletConnected ? "Bağlı (Freighter)" : "Bağlı Değil"}</span>
             </div>
             <div className="flex justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
               <span className="text-slate-400">Stake Modu</span>
               <span className="font-bold text-slate-100">{stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo"}</span>
             </div>
             <div className="flex justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
               <span className="text-slate-400">Ağ</span>
               <span className="font-bold text-slate-100">Testnet</span>
             </div>
             {stakeMode === "soroban" && sorobanConfigErr && (
               <SystemNotice title="Soroban yapılandırması" tone="amber">
                 {sorobanConfigErr}
               </SystemNotice>
             )}
          </div>
        </section>

        <section className="section-card p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-100">Son Bildirimler</h2>
          {recentClaims.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
              Henüz bildirim oluşturulmadı.
            </div>
          ) : (
            <div className="space-y-3">
              {recentClaims.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">{c.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{c.status}</p>
                  </div>
                  <Link to={c.status === "Needs Evidence" ? "/active" : c.status === "Verified" ? "/verified" : "/disputed"} className="ml-4 text-indigo-400 hover:text-indigo-300">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20">
            <Bot className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-100">AI Analizi Hakkında</h3>
            <p className="mt-1 text-sm leading-relaxed text-indigo-200/80">
              AI olayın doğru olup olmadığına karar vermez; yanlış bilgi riski ve doğrulama ihtiyacını değerlendirir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
