import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Award,
  Bot,
  Calendar,
  CalendarX2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hash,
  HelpCircle,
  Lock,
  Loader2,
  MapPin,
  Shield,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { shortHash } from "../lib/hash";
import { categoryLabels, riskLabels, statusLabels } from "../lib/labels";
import { getBadge } from "../lib/reputation";
import { getStakeMode, isSorobanReady, sorobanResolveAndPayout } from "../lib/sorobanEscrow";
import { shortAddress } from "../lib/wallet";
import type { Claim, ClaimStatus, CreditLedger, RiskLevel, Verification } from "../types";
import VerificationForm from "./VerificationForm";
import VerificationList from "./VerificationList";

type Props = {
  claim: Claim;
  walletAddress: string;
  walletConnected: boolean;
  creditLedger: CreditLedger;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
  onPayoutDone?: (claimId: string) => void;
  mode?: "full" | "compact";
};

function riskStyle(level: RiskLevel) {
  switch (level) {
    case "Low":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "Medium":
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";
    case "High":
      return "border-orange-400/25 bg-orange-500/10 text-orange-200";
    case "Critical":
      return "border-red-400/30 bg-red-500/15 text-red-100";
  }
}

function statusStyle(status: ClaimStatus) {
  switch (status) {
    case "Verified":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "False / Disputed":
      return "border-red-400/30 bg-red-500/15 text-red-100";
    default:
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  }
}

function statusIcon(status: ClaimStatus) {
  switch (status) {
    case "Verified":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "False / Disputed":
      return <XCircle className="h-3.5 w-3.5" />;
    default:
      return <AlertTriangle className="h-3.5 w-3.5" />;
  }
}

function witnessMessage(status: ClaimStatus) {
  if (status === "Verified") {
    return "Bu bildirim yeterli doğrulama aldı.";
  }

  if (status === "False / Disputed") {
    return "Bu bildirim topluluk doğrulamalarıyla yanlış veya şüpheli olarak işaretlendi.";
  }

  return "Bu bildirimi doğrulamak için bölgedeki kişilerden fotoğraf, açıklama veya bağlantı ile kanıt bekleniyor.";
}

function ExplorerLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-indigo-300 transition hover:text-indigo-100"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label || shortHash(hash)}
    </a>
  );
}

function CountPill({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${className}`}>
      {icon}
      {value} {label}
    </span>
  );
}

export default function ClaimCard({
  claim,
  walletAddress,
  walletConnected,
  creditLedger,
  onVerificationAdded,
  onPayoutDone,
  mode = "full",
}: Props) {
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const stakeMode = getStakeMode();
  const trueCount = claim.verifications.filter((v) => v.decision === "true").length;
  const falseCount = claim.verifications.filter((v) => v.decision === "false").length;
  const unsureCount = claim.verifications.filter((v) => v.decision === "unsure").length;
  const totalClaimCredits =
    claim.rewardCredits + claim.verifications.reduce((sum, verification) => sum + verification.rewardCredits, 0);
  const creatorBadge = getBadge(claim.creatorWallet, creditLedger);
  const isResolved = claim.status === "Verified" || claim.status === "False / Disputed";
  const claimUsedSoroban = claim.stakeMode === "soroban";
  const canShowPayoutButton =
    stakeMode === "soroban" && claimUsedSoroban && isResolved && !claim.escrowPayoutDone && isSorobanReady();
  const isFutureDate = (() => {
    if (!claim.incidentDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const incident = new Date(claim.incidentDate);
    return incident > today;
  })();

  const handlePayout = async () => {
    if (!walletConnected) {
      setPayoutError("Payout için Freighter cüzdanınızı bağlayın.");
      return;
    }

    setPayoutLoading(true);
    setPayoutError("");
    setPayoutSuccess(false);

    try {
      const result = await sorobanResolveAndPayout(walletAddress, claim.id);
      if (!result.success) {
        throw new Error("Payout transaction başarısız oldu.");
      }

      setPayoutSuccess(true);
      onPayoutDone?.(claim.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Stake iadesi çalıştırılamadı.";
      setPayoutError(msg);
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <article className="animate-fade-in overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/45">
      <div className="border-b border-slate-800 bg-slate-900/55 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h3 className="text-xl font-bold leading-tight text-slate-50">{claim.title}</h3>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
              {claim.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                  {claim.location}
                </span>
              )}
              {claim.incidentDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {claim.incidentDate}
                </span>
              )}
              {claim.incidentTime && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {claim.incidentTime}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {categoryLabels[claim.category] || claim.category}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {shortAddress(claim.creatorWallet)}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${creatorBadge.bg} ${creatorBadge.color}`}>
                {creatorBadge.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <span className={`badge ${statusStyle(claim.status)}`}>
              {statusIcon(claim.status)}
              {statusLabels[claim.status]}
            </span>
            <span className={`badge ${riskStyle(claim.ai.riskLevel)}`}>
              <Shield className="h-3.5 w-3.5" />
              {riskLabels[claim.ai.riskLevel]} Risk
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <p className="text-sm leading-relaxed text-slate-300">{claim.description}</p>

        {isFutureDate && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
            <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <p className="text-xs leading-relaxed text-amber-100">
              Tarih ileri bir zamanı gösteriyor. Bu bildirim gerçekleşmiş olay gibi değil, doğrulama bekleyen iddia olarak ele alınmalıdır.
            </p>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="inline-flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Bot className="h-4 w-4 text-indigo-300" />
                  AI Risk Analizi
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  AI olayın doğru olup olmadığına karar vermez; yanlış bilgi riski ve doğrulama ihtiyacını değerlendirir.
                </p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                Kaynak: {claim.ai.source === "gemini" ? "Gemini" : "Fallback"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <p className="text-xs text-slate-500">Risk seviyesi</p>
                <p className="mt-1 text-sm font-bold text-slate-100">{riskLabels[claim.ai.riskLevel]}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">AI risk eminliği</p>
                  <p className="text-sm font-bold text-slate-100">{claim.ai.confidence}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300"
                    style={{ width: `${claim.ai.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            {mode === "full" && (
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <p>{claim.ai.summary}</p>
                {claim.ai.signals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {claim.ai.signals.map((signal, index) => (
                      <span
                        key={`${signal}-${index}`}
                        className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-100"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Önerilen aksiyon</p>
                  <p className="mt-1 text-sm text-slate-200">{claim.ai.suggestedAction}</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
            <h4 className="inline-flex items-center gap-2 text-sm font-bold text-slate-100">
              <Lock className="h-4 w-4 text-violet-300" />
              XLM Stake ve Soroban
            </h4>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <span className="text-slate-500">Stake miktarı</span>
                <span className="font-bold text-slate-100">{claim.stakeAmount} testnet XLM</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <span className="text-slate-500">Stake modu</span>
                <span className="font-bold text-slate-100">
                  {claim.stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo"}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <p className="text-slate-500">Stake TX</p>
                <p className="mt-1 font-mono text-xs text-slate-100">
                  {claim.stakeTxHash ? <ExplorerLink hash={claim.stakeTxHash} /> : "Bekleniyor"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                <p className="text-slate-500">Soroban durum bilgisi</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {claim.stakeMode === "soroban"
                    ? claim.escrowPayoutDone
                      ? "Stake iadesi tamamlandı."
                      : isResolved
                        ? "Çözüldü, payout bekliyor."
                        : "Escrow stake kilidi aktif."
                    : "Treasury fallback ile stake alındı."}
                </p>
              </div>
              {claim.rewardsDistributed && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-100">
                  <Award className="h-4 w-4" />
                  Dağıtılan itibar kredisi: {totalClaimCredits}
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 text-[11px] text-slate-600">
              {claim.claimHash && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Hash className="h-3.5 w-3.5" />
                  Claim hash: {shortHash(claim.claimHash)}
                </span>
              )}
              {claim.aiReportHash && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Hash className="h-3.5 w-3.5" />
                  AI report hash: {shortHash(claim.aiReportHash)}
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
          <div className="flex flex-wrap gap-2">
            <CountPill
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Doğru"
              value={trueCount}
              className="border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
            />
            <CountPill
              icon={<XCircle className="h-3.5 w-3.5" />}
              label="Yanlış"
              value={falseCount}
              className="border-red-400/25 bg-red-500/10 text-red-200"
            />
            <CountPill
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              label="Emin değilim"
              value={unsureCount}
              className="border-amber-400/25 bg-amber-500/10 text-amber-200"
            />
          </div>
          <p className="mt-3 text-sm text-slate-300">{witnessMessage(claim.status)}</p>
        </div>

        {canShowPayoutButton && (
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-violet-100">Stake iadesi hazır</h4>
                <p className="mt-1 text-xs text-violet-200/75">
                  Soroban escrow, sonuca göre kazanan tarafların stake iadesini yönetir.
                </p>
              </div>
              <button onClick={handlePayout} disabled={payoutLoading} className="btn-primary shrink-0">
                {payoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Stake iadesini çalıştır
                  </>
                )}
              </button>
            </div>
            {payoutError && (
              <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
                {payoutError}
              </p>
            )}
            {payoutSuccess && (
              <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Stake iadesi tamamlandı.
              </p>
            )}
          </div>
        )}

        {claim.escrowPayoutDone && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Stake iadesi tamamlandı.
          </div>
        )}

        {mode === "full" ? (
          <>
            <VerificationList verifications={claim.verifications} creditLedger={creditLedger} />

            <VerificationForm
              claimId={claim.id}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              existingVerifications={claim.verifications}
              onVerificationAdded={onVerificationAdded}
            />
          </>
        ) : (
          <details className="group mt-4 cursor-pointer">
            <summary className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
              Doğrulama Detaylarını Göster
            </summary>
            <div className="mt-4 space-y-5">
              <VerificationList verifications={claim.verifications} creditLedger={creditLedger} />
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
