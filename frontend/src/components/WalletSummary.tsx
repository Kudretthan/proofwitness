import { Wallet, Globe, Unplug, Award, Coins, Trash2, Database, ShieldCheck } from "lucide-react";
import type { WalletState } from "../lib/wallet";
import { shortAddress } from "../lib/wallet";
import { getTreasuryAddress } from "../lib/stellarStake";
import { getBadgeByCredits } from "../lib/reputation";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
  connecting: boolean;
  userCredits: number;
  onClearData: () => void;
};

export default function WalletSummary({ wallet, onConnect, connecting, userCredits, onClearData }: Props) {
  const treasury = getTreasuryAddress();
  const badge = getBadgeByCredits(userCredits);

  if (wallet.connected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Rozet */}
          <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 ${badge.bg}`}>
            <ShieldCheck className={`w-3.5 h-3.5 ${badge.color}`} />
            <span className={`text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>

          {/* İtibar Kredisi */}
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">
              İtibar Krediniz: {userCredits}
            </span>
          </div>

          {/* Cüzdan */}
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">
              {shortAddress(wallet.publicKey)}
            </span>
          </div>

          {/* Ağ */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl px-3 py-2">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px] text-gray-400">
              {wallet.network === "TESTNET" || wallet.network === "testnet"
                ? "Testnet"
                : wallet.network || "unknown"}
            </span>
          </div>

          {/* Stake bilgisi */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl px-3 py-2">
            <Coins className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] text-gray-400">
              {treasury ? `Treasury: ${shortAddress(treasury)}` : "Treasury yok"}
            </span>
          </div>
        </div>

        {/* Alt bilgi satırı */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <Database className="w-3 h-3" />
            Sayfa yenilense bile bildirimler bu tarayıcıda saklanır.
          </span>
          <button
            onClick={onClearData}
            className="flex items-center gap-1 text-[10px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Yerel verileri temizle
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="btn-primary flex items-center gap-2 text-sm"
    >
      {connecting ? (
        <>
          <span className="animate-pulse-soft">Bağlanıyor...</span>
        </>
      ) : (
        <>
          <Unplug className="w-4 h-4" />
          Freighter Bağla
        </>
      )}
    </button>
  );
}
