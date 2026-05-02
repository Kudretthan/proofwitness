import { useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Hash,
  HelpCircle,
  User,
  XCircle,
} from "lucide-react";
import { shortHash } from "../lib/hash";
import { getBadge, isAnonymous } from "../lib/reputation";
import { shortAddress } from "../lib/wallet";
import type { CreditLedger, Verification } from "../types";

type Props = {
  verifications: Verification[];
  creditLedger: CreditLedger;
};

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "true") {
    return (
      <span className="badge border border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Doğru
      </span>
    );
  }

  if (decision === "false") {
    return (
      <span className="badge border border-red-400/25 bg-red-500/10 text-red-200">
        <XCircle className="h-3.5 w-3.5" />
        Yanlış
      </span>
    );
  }

  return (
    <span className="badge border border-amber-400/25 bg-amber-500/10 text-amber-200">
      <HelpCircle className="h-3.5 w-3.5" />
      Emin değilim
    </span>
  );
}

export default function VerificationList({ verifications, creditLedger }: Props) {
  if (verifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-500">
        Henüz doğrulama yok. Bölgedeki kişiler kanıt ekleyerek doğrulama yapabilir.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-slate-100">Doğrulamalar ({verifications.length})</h4>
      <div className="relative space-y-4 pl-4 before:absolute before:left-1.5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-700">
        {verifications.map((verification) => (
          <VerificationCard key={verification.id} verification={verification} creditLedger={creditLedger} />
        ))}
      </div>
    </div>
  );
}

function VerificationCard({
  verification,
  creditLedger,
}: {
  verification: Verification;
  creditLedger: CreditLedger;
}) {
  const [imgError, setImgError] = useState(false);
  const verifierBadge = getBadge(verification.verifierWallet, creditLedger);
  const anon = isAnonymous(verification.verifierWallet);
  const isImage =
    verification.evidenceUrl &&
    (verification.evidenceUrl.match(/\.(png|jpe?g|webp)$/i) || verification.evidenceUrl.includes("/uploads/"));

  return (
    <article className="relative rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <span className="absolute -left-[1.07rem] top-5 h-3 w-3 rounded-full border border-indigo-300/50 bg-indigo-500 shadow-lg shadow-indigo-500/30" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <DecisionBadge decision={verification.decision} />
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {shortAddress(verification.verifierWallet)}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${verifierBadge.bg} ${verifierBadge.color}`}>
            {verifierBadge.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(verification.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      {anon && <p className="mt-2 text-xs text-slate-600">Anonim doğrulamalarda itibar kalıcı değildir.</p>}

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{verification.note}</p>

      {verification.evidenceUrl && isImage && !imgError && (
        <img
          src={verification.evidenceUrl}
          alt="Kanıt"
          className="mt-3 max-h-56 w-full rounded-xl border border-slate-800 object-cover"
          onError={() => setImgError(true)}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3.5 w-3.5 text-indigo-300" />
          Stake: {verification.stakeAmount} XLM
        </span>
        {verification.stakeTxHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${verification.stakeTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-300 transition hover:text-indigo-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            TX: {shortHash(verification.stakeTxHash)}
          </a>
        )}
        {verification.rewardCredits > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Award className="h-3.5 w-3.5" />
            Kazanılan itibar: +{verification.rewardCredits}
          </span>
        ) : (
          <span className="text-slate-600">İtibar bekliyor</span>
        )}
        {verification.verificationHash && (
          <span className="inline-flex items-center gap-1 font-mono text-slate-600">
            <Hash className="h-3.5 w-3.5" />
            {shortHash(verification.verificationHash)}
          </span>
        )}
        {verification.evidenceUrl && (
          <a
            href={verification.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-300 transition hover:text-cyan-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Kanıtı aç
          </a>
        )}
      </div>
    </article>
  );
}
