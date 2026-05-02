import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Hash,
  User,
  Clock,
  Coins,
  Award,
} from "lucide-react";
import { shortAddress } from "../lib/wallet";
import { shortHash } from "../lib/hash";
import { getBadge, isAnonymous } from "../lib/reputation";
import type { Verification, CreditLedger } from "../types";

type Props = {
  verifications: Verification[];
  creditLedger: CreditLedger;
};

function DecisionBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "true":
      return (
        <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> Doğru
        </span>
      );
    case "false":
      return (
        <span className="badge bg-red-500/15 text-red-400 border border-red-500/30">
          <XCircle className="w-3 h-3" /> Yanlış
        </span>
      );
    default:
      return (
        <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <HelpCircle className="w-3 h-3" /> Emin değilim
        </span>
      );
  }
}

export default function VerificationList({ verifications, creditLedger }: Props) {
  if (verifications.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic mt-3">
        Henüz doğrulama yok. Bölgedeki kişiler kanıt ekleyerek doğrulama yapabilir.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-300">
        Doğrulamalar ({verifications.length})
      </h4>
      {verifications.map((v) => (
        <VerificationCard key={v.id} verification={v} creditLedger={creditLedger} />
      ))}
    </div>
  );
}

function VerificationCard({ verification: v, creditLedger }: { verification: Verification; creditLedger: CreditLedger }) {
  const [imgError, setImgError] = useState(false);
  const verifierBadge = getBadge(v.verifierWallet, creditLedger);
  const anon = isAnonymous(v.verifierWallet);

  const isImage =
    v.evidenceUrl &&
    (v.evidenceUrl.match(/\.(png|jpe?g|webp)$/i) ||
      v.evidenceUrl.includes("/uploads/"));

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <DecisionBadge decision={v.decision} />
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {shortAddress(v.verifierWallet)}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${verifierBadge.bg} ${verifierBadge.color}`}>
            {verifierBadge.label}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(v.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {anon && (
        <p className="text-[10px] text-gray-600 italic">Anonim doğrulamalarda itibar kalıcı değildir.</p>
      )}

      <p className="text-sm text-gray-300">{v.note}</p>

      {/* Stake bilgisi */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Coins className="w-3 h-3 text-indigo-400" />
          Stake: {v.stakeAmount} XLM
        </span>
        {v.stakeTxHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${v.stakeTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            TX: {shortHash(v.stakeTxHash)}
          </a>
        )}
        {v.rewardCredits > 0 ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <Award className="w-3 h-3" />
            Kazanılan itibar: +{v.rewardCredits}
          </span>
        ) : (
          <span className="text-gray-600">İtibar bekliyor</span>
        )}
      </div>

      {/* Evidence image */}
      {v.evidenceUrl && isImage && !imgError && (
        <img
          src={v.evidenceUrl}
          alt="Kanıt"
          className="w-full max-h-48 object-cover rounded-lg border border-[var(--color-border)]"
          onError={() => setImgError(true)}
        />
      )}

      {/* Evidence link */}
      {v.evidenceUrl && (
        <a
          href={v.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Kanıtı aç
        </a>
      )}

      {/* Hash */}
      {v.verificationHash && (
        <div className="flex items-center gap-1 text-[10px] text-gray-600">
          <Hash className="w-3 h-3" />
          {shortHash(v.verificationHash)}
        </div>
      )}
    </div>
  );
}
