import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  HelpCircle,
  Link2,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { uploadEvidence } from "../lib/api";
import { buildVerificationHash } from "../lib/hash";
import {
  getSorobanConfigError,
  getStakeMode,
  getStakeModeConfigError,
  isSorobanReady,
  sorobanAddVerificationWithStake,
} from "../lib/sorobanEscrow";
import { getTreasuryAddress, stakeXlmWithFreighter } from "../lib/stellarStake";
import type { Verification, VerificationDecision } from "../types";

type Props = {
  claimId: string;
  walletAddress: string;
  walletConnected: boolean;
  existingVerifications: Verification[];
  onVerificationAdded: (claimId: string, verification: Verification) => void;
};

const DECISIONS: {
  value: VerificationDecision;
  label: string;
  icon: ReactNode;
  activeClass: string;
}[] = [
  {
    value: "true",
    label: "Doğru",
    icon: <CheckCircle2 className="h-4 w-4" />,
    activeClass: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
  },
  {
    value: "false",
    label: "Yanlış",
    icon: <XCircle className="h-4 w-4" />,
    activeClass: "border-red-400/50 bg-red-500/15 text-red-100",
  },
  {
    value: "unsure",
    label: "Emin değilim / Ek kanıt",
    icon: <HelpCircle className="h-4 w-4" />,
    activeClass: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  },
];

const VERIFY_STAKE_AMOUNT = "0.1";

export default function VerificationForm({
  claimId,
  walletAddress,
  walletConnected,
  existingVerifications,
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
  const modeLabel = stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo";

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

    if (!walletConnected) {
      setError("XLM stake için önce Freighter cüzdanınızı bağlamalısınız.");
      return;
    }

    const alreadyVerified = existingVerifications.some(
      (verification) =>
        verification.verifierWallet.toLowerCase() === walletAddress.toLowerCase()
    );
    if (alreadyVerified) {
      setError("Bu cüzdan bu bildirimi zaten doğruladı.");
      return;
    }

    if (!note.trim()) {
      setError("Açıklama zorunludur.");
      return;
    }

    // VITE_STAKE_MODE geçersizse işlemi durdur
    const stakeModeErr = getStakeModeConfigError();
    if (stakeModeErr) {
      setError(stakeModeErr);
      return;
    }

    if (stakeMode === "soroban") {
      if (!isSorobanReady()) {
        const configErr = getSorobanConfigError();
        setError(configErr || "Soroban escrow yapılandırması eksik.");
        return;
      }
    } else if (stakeMode === "treasury") {
      const treasury = getTreasuryAddress();
      if (!treasury) {
        setError("Stake treasury adresi tanımlı değil.");
        return;
      }
    }

    setLoading(true);

    try {
      let evidenceUrl: string | undefined;
      if (file) {
        setLoadingMsg("Kanıt yükleniyor...");
        const result = await uploadEvidence(file);
        evidenceUrl = result.url;
      } else if (evidenceUrlInput.trim()) {
        evidenceUrl = evidenceUrlInput.trim();
      }

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

      let stakeTxHash = "";
      setLoadingMsg("XLM stake işlemi bekleniyor...");

      if (stakeMode === "soroban") {
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
          console.error("Soroban escrow failed:", err);
          // Soroban modunda treasury fallback YOKTUR. İşlemi durdur.
          throw new Error("Soroban escrow işlemi başarısız oldu. Treasury fallback devre dışı.");
        }
      } else if (stakeMode === "treasury") {
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
      } else {
        // Bu noktaya asılırsa VITE_STAKE_MODE yanlış tanımlanmış demektir
        throw new Error("Geçersiz stake modu. Doğrulama eklenemedi.");
      }

      setLoadingMsg("Doğrulama ekleniyor...");

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

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-100">Doğrulama Ekle</h4>
          <p className="mt-1 text-xs text-slate-500">Kararınızı not ve opsiyonel kanıtla destekleyin.</p>
        </div>
        <span className="badge border border-indigo-400/25 bg-indigo-500/10 text-indigo-200">
          <Coins className="h-3.5 w-3.5" />
          {VERIFY_STAKE_AMOUNT} XLM · {modeLabel}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {DECISIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setDecision(item.value)}
            disabled={loading}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              decision === item.value
                ? item.activeClass
                : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Gözleminizi veya bilginizi yazın"
        rows={4}
        className="input-field mt-3 resize-none"
        disabled={loading}
      />

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3.5 py-3 text-sm text-slate-300 transition hover:border-indigo-400/50">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Upload className="h-4 w-4 shrink-0 text-indigo-300" />
            <span className="truncate">{file ? file.name : "Kanıt fotoğrafı, opsiyonel"}</span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
        </label>

        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="url"
            value={evidenceUrlInput}
            onChange={(e) => setEvidenceUrlInput(e.target.value)}
            placeholder="Kanıt URL'si, opsiyonel"
            className="input-field pl-10"
            disabled={loading}
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-sm text-red-100">{error}</p>
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingMsg || "Doğrulama ekleniyor..."}
          </>
        ) : (
          "0.1 testnet XLM stake ile doğrulamayı gönder"
        )}
      </button>
    </form>
  );
}
