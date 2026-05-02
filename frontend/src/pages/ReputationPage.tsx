import { Award } from "lucide-react";
import type { CreditLedger } from "../types";
import { getBadge } from "../lib/reputation";
import { shortAddress } from "../lib/wallet";

type Props = {
  creditLedger: CreditLedger;
  walletAddress: string;
};

export default function ReputationPage({ creditLedger, walletAddress }: Props) {
  const sortedUsers = Object.entries(creditLedger).sort(([, a], [, b]) => b - a);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-50">İtibar</h1>
        <p className="mt-2 text-slate-400">
          İtibar kredisi, doğru çıkan doğrulamalardan kazanılır ve Freighter cüzdan adresine bağlıdır.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="section-card p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-100">Kredi Kullanım Alanları</h2>
          <ul className="list-inside list-disc space-y-2 text-sm text-slate-300">
            <li>Güvenilir doğrulayıcı rozeti</li>
            <li>Gelecekte oy ağırlığı</li>
            <li>Gelecekte daha düşük stake</li>
            <li>Soroban escrow ile XLM ödül/ceza sistemi</li>
          </ul>
        </section>

        <section className="section-card p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-100">Sizin İtibarınız</h2>
          {walletAddress === "not-connected" ? (
            <p className="text-sm text-slate-400">Cüzdan bağlı değil.</p>
          ) : (
            <div>
              <p className="text-2xl font-black text-slate-50">{creditLedger[walletAddress] || 0} Kredi</p>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getBadge(walletAddress, creditLedger).bg} ${getBadge(walletAddress, creditLedger).color}`}>
                  {getBadge(walletAddress, creditLedger).label}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="section-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <Award className="h-6 w-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-100">Liderlik Tablosu</h2>
        </div>
        
        {sortedUsers.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz itibar kazanan kimse yok.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {sortedUsers.map(([address, credits], index) => {
              const badge = getBadge(address, creditLedger);
              const isMe = address === walletAddress;
              return (
                <div key={address} className={`flex items-center justify-between py-4 ${isMe ? "bg-indigo-500/5 px-4 -mx-4 rounded-lg" : ""}`}>
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-slate-400">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-200">
                        {isMe ? "Siz" : shortAddress(address)}
                      </p>
                      <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-50">{credits}</p>
                    <p className="text-xs text-slate-500">Kredi</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
