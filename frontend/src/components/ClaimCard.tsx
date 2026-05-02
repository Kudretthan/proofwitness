import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
  MapPin,
  Calendar,
  CalendarX2,
  Clock,
  Tag,
  User,
  Bot,
  ChevronDown,
  ChevronUp,
  Coins,
  ExternalLink,
  Award,
  Info,
  Loader2,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { shortAddress } from "../lib/wallet";
import { shortHash } from "../lib/hash";
import { getStakeMode, sorobanResolveAndPayout, isSorobanReady } from "../lib/sorobanEscrow";
import VerificationForm from "./VerificationForm";
import VerificationList from "./VerificationList";
import type { Claim, Verification, RiskLevel, CreditLedger } from "../types";
import { riskLabels, statusLabels, categoryLabels } from "../lib/labels";
import { getBadge } from "../lib/reputation";

type Props = {
  claim: Claim;
  walletAddress: string;
  walletConnected: boolean;
  creditLedger: CreditLedger;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
  onPayoutDone?: (claimId: string) => void;
};

function riskColor(level: RiskLevel) {
  switch (level) {
    case "Low":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Medium":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "High":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "Critical":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "Verified":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "False / Disputed":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Verified":
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "False / Disputed":
      return <XCircle className="w-3.5 h-3.5" />;
    default:
      return <AlertTriangle className="w-3.5 h-3.5" />;
  }
}

function StellarExpertLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {shortHash(hash)}
    </a>
  );
}

export default function ClaimCard({ claim, walletAddress, walletConnected, creditLedger, onVerificationAdded, onPayoutDone }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const stakeMode = getStakeMode();

  const trueCount = claim.verifications.filter((v) => v.decision === "true").length;
  const falseCount = claim.verifications.filter((v) => v.decision === "false").length;
  const unsureCount = claim.verifications.filter((v) => v.decision === "unsure").length;

  const glowClass =
    claim.status === "Verified"
      ? "card-glow-green"
      : claim.status === "False / Disputed"
      ? "card-glow-red"
      : "card-glow";

  // Toplam dağıtılan kredi
  const totalClaimCredits =
    claim.rewardCredits +
    claim.verifications.reduce((sum, v) => sum + v.rewardCredits, 0);

  // İleri tarih kontrolü
  const isFutureDate = (() => {
    if (!claim.incidentDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const incident = new Date(claim.incidentDate);
    return incident > today;
  })();

  // Soroban payout eligibility
  const isResolved = claim.status === "Verified" || claim.status === "False / Disputed";
  const claimUsedSoroban = claim.stakeMode === "soroban";
  const canShowPayoutButton =
    stakeMode === "soroban" &&
    claimUsedSoroban &&
    isResolved &&
    !claim.escrowPayoutDone &&
    isSorobanReady();

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

  // Mode badge
  const modeBadge = claim.stakeMode === "soroban" ? (
    <span className="badge bg-violet-500/15 text-violet-300 border border-violet-500/30">
      <Lock className="w-3 h-3" /> Escrow
    </span>
  ) : null;

  return (
    <div
      className={`bg-[var(--color-surface-card)] rounded-2xl p-5 space-y-4 animate-fade-in ${glowClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-100 leading-tight mb-1.5">
            {claim.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* Status badge */}
            <span
              className={`badge border ${statusStyle(claim.status)}`}
            >
              {statusIcon(claim.status)}
              {statusLabels[claim.status] || claim.status}
            </span>
            {/* Risk badge */}
            <span
              className={`badge border ${riskColor(claim.ai.riskLevel)}`}
            >
              <Shield className="w-3 h-3" />
              {riskLabels[claim.ai.riskLevel] || claim.ai.riskLevel} Risk
            </span>
            {/* Mode badge */}
            {modeBadge}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 leading-relaxed">{claim.description}</p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        {claim.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {claim.location}
          </span>
        )}
        {claim.incidentDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {claim.incidentDate}
          </span>
        )}
        {claim.incidentTime && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {claim.incidentTime}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Tag className="w-3 h-3" /> {categoryLabels[claim.category] || claim.category}
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" /> {shortAddress(claim.creatorWallet)}
        </span>
        {(() => {
          const creatorBadge = getBadge(claim.creatorWallet, creditLedger);
          return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${creatorBadge.bg} ${creatorBadge.color}`}>
              {creatorBadge.label}
            </span>
          );
        })()}
      </div>

      {/* Stake bilgisi */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Coins className="w-3 h-3 text-indigo-400" />
          Stake: {claim.stakeAmount} testnet XLM
        </span>
        {claim.stakeTxHash && (
          <span className="flex items-center gap-1 text-[11px]">
            Stake TX: <StellarExpertLink hash={claim.stakeTxHash} />
          </span>
        )}
        {claim.rewardsDistributed && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Award className="w-3 h-3" />
            İtibar kredisi dağıtıldı (toplam: {totalClaimCredits})
          </span>
        )}
        {claim.escrowPayoutDone && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Lock className="w-3 h-3" />
            Escrow stake iadesi tamamlandı
          </span>
        )}
      </div>

      {/* Doğruluk durumu */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Doğruluk durumu:</span>
        <span className={`font-semibold ${claim.status === "Verified" ? "text-emerald-400" : claim.status === "False / Disputed" ? "text-red-400" : "text-amber-400"}`}>
          {statusLabels[claim.status] || claim.status}
        </span>
      </div>

      {/* İleri tarih uyarısı */}
      {isFutureDate && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <CalendarX2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-relaxed">
            Tarih ileri bir zamanı gösteriyor. Bu nedenle bildirim gerçekleşmiş bir olay gibi değerlendirilmemeli ve mutlaka doğrulama beklemelidir.
          </p>
        </div>
      )}

      {/* Verification counts */}
      <div className="flex gap-3">
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> {trueCount} Doğru
        </span>
        <span className="flex items-center gap-1 text-xs text-red-400">
          <XCircle className="w-3.5 h-3.5" /> {falseCount} Yanlış
        </span>
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <HelpCircle className="w-3.5 h-3.5" /> {unsureCount} Emin değilim
        </span>
      </div>

      {/* Soroban Payout Button */}
      {canShowPayoutButton && (
        <div className="space-y-2">
          <button
            onClick={handlePayout}
            disabled={payoutLoading}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 py-2"
          >
            {payoutLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Stake iadesi işleniyor...
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Stake iadesini çalıştır
              </>
            )}
          </button>
          {payoutError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{payoutError}</p>
            </div>
          )}
          {payoutSuccess && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">Kazanan tarafların stake iadesi tamamlandı.</p>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <>
          {/* AI Analysis */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
              <Bot className="w-4 h-4 text-indigo-400" />
              AI Analizi
              <span className="ml-auto text-[10px] font-normal text-gray-500">
                Kaynak: {claim.ai.source === "gemini" ? "Gemini" : "Kural tabanlı yedek analiz"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              AI bu bildirimin metnini, konumunu, tarihini, saatini ve kategorisini analiz eder.
              Olayın kesin doğru veya yanlış olduğuna karar vermez; sadece yanlış bilgi riski ve
              doğrulama ihtiyacını değerlendirir.
            </p>

            {/* Confidence bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>AI risk eminliği</span>
                <span>{claim.ai.confidence}%</span>
              </div>
              <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${claim.ai.confidence}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                <Info className="w-3 h-3 shrink-0" />
                Bu yüzde, olayın doğru olma ihtimali değildir. AI'ın yanlış bilgi riski analizinden ne kadar emin olduğunu gösterir.
              </p>
            </div>

            <p className="text-sm text-gray-300">{claim.ai.summary}</p>

            {/* Signals */}
            {claim.ai.signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {claim.ai.signals.map((s, i) => (
                  <span
                    key={i}
                    className="text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2 py-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 italic">
              💡 Önerilen aksiyon: {claim.ai.suggestedAction}
            </p>
          </div>

          {/* Hashes */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
            {claim.claimHash && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" /> Bildirim: {shortHash(claim.claimHash)}
              </span>
            )}
            {claim.aiReportHash && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" /> AI Rapor: {shortHash(claim.aiReportHash)}
              </span>
            )}
          </div>

          {/* Verification List */}
          <VerificationList verifications={claim.verifications} creditLedger={creditLedger} />

          {/* Verification Form */}
          <VerificationForm
            claimId={claim.id}
            walletAddress={walletAddress}
            walletConnected={walletConnected}
            onVerificationAdded={onVerificationAdded}
          />
        </>
      )}
    </div>
  );
}
