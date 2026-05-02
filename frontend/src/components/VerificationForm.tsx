import { useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Upload,
  Link2,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { uploadEvidence } from "../lib/api";
import { buildVerificationHash } from "../lib/hash";
import { stakeXlmWithFreighter, getTreasuryAddress } from "../lib/stellarStake";
import {
  getStakeMode,
  isSorobanReady,
  getSorobanConfigError,
  sorobanAddVerificationWithStake,
} from "../lib/sorobanEscrow";
import type { Verification, VerificationDecision } from "../types";

type Props = {
  claimId: string;
  walletAddress: string;
  walletConnected: boolean;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
};

const DECISIONS: { value: VerificationDecision; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: "true",
    label: "Doğru",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  },
  {
    value: "false",
    label: "Yanlış",
    icon: <XCircle className="w-4 h-4" />,
    color: "border-red-500/50 bg-red-500/10 text-red-300",
  },
  {
    value: "unsure",
    label: "Emin değilim / Ek kanıt",
    icon: <HelpCircle className="w-4 h-4" />,
    color: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  },
];

const VERIFY_STAKE_AMOUNT = "0.1";

export default function VerificationForm({
  claimId,
  walletAddress,
  walletConnected,
  onVerificationAdded,
}: Props) {
  const [decision, setDecision] = useState<VerificationDecision>("unsure");
  const [note, setNote] = useState("");
  const [evidenceUrlInput, setEvidenceUrlInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const stakeMode = getStakeMode();

  const resetForm = () => {
    setDecision("unsure");
    setNote("");
    setEvidenceUrlInput("");
    setFile(null);
    setError("");
    setLoadingMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!note.trim()) {
      setError("Açıklama zorunludur.");
      return;
    }

    if (!walletConnected) {
      setError("XLM stake için önce Freighter cüzdanınızı bağlamalısınız.");
      return;
    }

    // ─── Mode-specific validation ───
    if (stakeMode === "soroban") {
      if (!isSorobanReady()) {
        const configErr = getSorobanConfigError();
        setError(configErr || "Soroban escrow yapılandırması eksik.");
        return;
      }
    } else {
      const treasury = getTreasuryAddress();
      if (!treasury) {
        setError("Stake treasury adresi tanımlı değil.");
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Upload file if selected
      let evidenceUrl: string | undefined;
      if (file) {
        setLoadingMsg("Kanıt yükleniyor...");
        const result = await uploadEvidence(file);
        evidenceUrl = result.url;
      } else if (evidenceUrlInput.trim()) {
        evidenceUrl = evidenceUrlInput.trim();
      }

      // 2. Build hash
      const createdAt = new Date().toISOString();
      const verifierWallet = walletAddress;
      const verificationId = crypto.randomUUID();

      const verificationHash = await buildVerificationHash({
        claimId,
        verifierWallet,
        decision,
        note: note.trim(),
        evidenceUrl,
        createdAt,
      });

      // 3. Stake (mode-dependent)
      let stakeTxHash = "";

      if (stakeMode === "soroban") {
        setLoadingMsg("Soroban escrow stake işlemi bekleniyor...");
        try {
          const result = await sorobanAddVerificationWithStake(
            walletAddress,
            claimId,
            verificationId,
            decision,
            verificationHash,
            evidenceUrl || ""
          );
          if (!result.success) {
            throw new Error("Soroban escrow verification stake başarısız oldu.");
          }
          stakeTxHash = result.txHash;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Soroban escrow hatası";
          throw new Error(`Soroban escrow hatası: ${msg}`, { cause: err });
        }
      } else {
        setLoadingMsg("XLM stake işlemi bekleniyor...");
        const treasury = getTreasuryAddress();
        const stakeResult = await stakeXlmWithFreighter({
          sourcePublicKey: walletAddress,
          destinationPublicKey: treasury,
          amount: VERIFY_STAKE_AMOUNT,
          memoText: "PW-VERIFY",
        });

        if (!stakeResult.successful) {
          throw new Error("Stake transaction başarısız oldu.");
        }
        stakeTxHash = stakeResult.hash;
      }

      const verification: Verification = {
        id: verificationId,
        claimId,
        verifierWallet,
        decision,
        note: note.trim(),
        evidenceUrl,
        createdAt,
        verificationHash,
        stakeAmount: VERIFY_STAKE_AMOUNT,
        stakeTxHash,
        rewardCredits: 0,
      };

      onVerificationAdded(claimId, verification);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Doğrulama eklenemedi.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const modeLabel = stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 pt-4 border-t border-[var(--color-border)]">
      <h4 className="text-sm font-semibold text-gray-300">Doğrulama Ekle</h4>

      {/* Stake bilgisi */}
      <div className="flex items-center gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-lg p-2">
        <Coins className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <p className="text-[10px] text-indigo-300">
          Doğrulama eklemek için <span className="font-semibold">{VERIFY_STAKE_AMOUNT} testnet XLM</span> stake edilir.
          <span className="ml-1 text-indigo-400/70">({modeLabel})</span>
        </p>
      </div>

      {/* Decision buttons */}
      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDecision(d.value)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              decision === d.value
                ? d.color
                : "border-[var(--color-border)] bg-transparent text-gray-400 hover:border-gray-500"
            }`}
          >
            {d.icon}
            {d.label}
          </button>
        ))}
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Gözleminizi veya bilginizi yazın"
        rows={2}
        className="input-field resize-none text-sm"
        disabled={loading}
      />

      {/* Evidence photo */}
      <div className="flex items-center gap-2">
        <label className="btn-secondary flex items-center gap-1.5 text-xs cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {file ? file.name : "Kanıt fotoğrafı, opsiyonel"}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
        </label>
      </div>

      {/* Evidence URL */}
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-gray-500 shrink-0" />
        <input
          type="url"
          value={evidenceUrlInput}
          onChange={(e) => setEvidenceUrlInput(e.target.value)}
          placeholder="Varsa kanıt bağlantısı ekleyin"
          className="input-field text-sm py-2"
          disabled={loading}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full text-sm flex items-center justify-center gap-2 py-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {loadingMsg}
          </>
        ) : (
          "Doğrulamayı Gönder"
        )}
      </button>
    </form>
  );
}
