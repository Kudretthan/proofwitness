import {
  Award,
  Coins,
  Database,
  Globe2,
  Lock,
  ShieldCheck,
  Trash2,
  Unplug,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { getBadgeByCredits } from "../lib/reputation";
import { getStakeMode } from "../lib/sorobanEscrow";
import { getTreasuryAddress } from "../lib/stellarStake";
import type { WalletState } from "../lib/wallet";
import { shortAddress } from "../lib/wallet";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
  connecting: boolean;
  userCredits: number;
  onClearData: () => void;
  variant?: "topbar" | "card";
};

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/35 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className="text-right text-xs font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export default function WalletSummary({
  wallet,
  onConnect,
  connecting,
  userCredits,
  onClearData,
  variant = "topbar",
}: Props) {
  const treasury = getTreasuryAddress();
  const stakeMode = getStakeMode();
  const badge = getBadgeByCredits(userCredits);
  const networkLabel =
    wallet.network === "TESTNET" || wallet.network === "testnet"
      ? "Testnet"
      : wallet.network || "Testnet";

  if (variant === "topbar") {
    if (!wallet.connected) {
      return (
        <button onClick={onConnect} disabled={connecting} className="btn-primary px-3 py-2 sm:px-4">
          <Unplug className="h-4 w-4" />
          <span className="hidden sm:inline">{connecting ? "Bağlanıyor..." : "Freighter Bağla"}</span>
          <span className="sm:hidden">Bağla</span>
        </button>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        <span className={`badge hidden border sm:inline-flex ${badge.bg} ${badge.color}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {badge.label}
        </span>
        <span className="badge border border-amber-400/25 bg-amber-500/10 text-amber-200">
          <Award className="h-3.5 w-3.5" />
          {userCredits}
        </span>
        <span className="badge border border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
          <Wallet className="h-3.5 w-3.5" />
          {shortAddress(wallet.publicKey)}
        </span>
      </div>
    );
  }

  return (
    <section className="section-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Wallet ve Escrow</h2>
          <p className="mt-1 text-xs text-slate-400">
            Freighter imzası, stake modu ve demo itibar durumunuz.
          </p>
        </div>
        <span className={`badge border ${stakeMode === "soroban" ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-sky-400/30 bg-sky-500/10 text-sky-200"}`}>
          <Lock className="h-3.5 w-3.5" />
          {stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo"}
        </span>
      </div>

      {!wallet.connected ? (
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
          <p className="text-sm text-indigo-100">
            XLM stake ve doğrulama için Freighter cüzdanınızı bağlayın.
          </p>
          <button onClick={onConnect} disabled={connecting} className="btn-primary mt-4 w-full">
            <Unplug className="h-4 w-4" />
            {connecting ? "Bağlanıyor..." : "Freighter Bağla"}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <DetailRow
            icon={<Wallet className="h-4 w-4 text-emerald-300" />}
            label="Bağlı cüzdan"
            value={shortAddress(wallet.publicKey)}
          />
          <DetailRow
            icon={<Globe2 className="h-4 w-4 text-cyan-300" />}
            label="Ağ"
            value={networkLabel}
          />
          <DetailRow
            icon={<Coins className="h-4 w-4 text-indigo-300" />}
            label="Stake modu"
            value={stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo"}
          />
          <DetailRow
            icon={<Award className="h-4 w-4 text-amber-300" />}
            label="İtibar kredisi"
            value={userCredits}
          />
          <DetailRow
            icon={<ShieldCheck className={`h-4 w-4 ${badge.color}`} />}
            label="Rozet"
            value={<span className={badge.color}>{badge.label}</span>}
          />
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
        <p>
          Contract ID:{" "}
          <span className="font-mono text-slate-200">
            {import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID
              ? shortAddress(import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID)
              : "tanımlı değil"}
          </span>
        </p>
        <p>
          Treasury fallback:{" "}
          <span className="font-mono text-slate-200">{treasury ? shortAddress(treasury) : "tanımlı değil"}</span>
        </p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <Database className="h-3.5 w-3.5" />
            Demo verisi localStorage ile kalıcıdır.
          </span>
          <button
            type="button"
            onClick={onClearData}
            className="inline-flex items-center gap-1.5 text-red-300/75 transition hover:text-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Temizle
          </button>
        </div>
      </div>
    </section>
  );
}
