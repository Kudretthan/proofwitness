import { useState } from "react";
import { AlertTriangle, Coins, Loader2, Send } from "lucide-react";
import { analyzeClaim } from "../lib/api";
import { buildAiReportHash, buildClaimHash } from "../lib/hash";
import {
  getSorobanConfigError,
  getStakeMode,
  getStakeModeConfigError,
  isSorobanReady,
  sorobanCreateClaimWithStake,
} from "../lib/sorobanEscrow";
import { getTreasuryAddress, stakeXlmWithFreighter } from "../lib/stellarStake";
import type { AIReport, Claim } from "../types";

type Props = {
  walletAddress: string;
  walletConnected: boolean;
  onClaimCreated: (claim: Claim) => void;
};

const CATEGORIES = [
  { value: "earthquake", label: "Deprem" },
  { value: "flood", label: "Sel" },
  { value: "fire", label: "Yangın" },
  { value: "infrastructure", label: "Altyapı" },
  { value: "explosion", label: "Patlama" },
  { value: "road", label: "Yol" },
  { value: "health", label: "Sağlık" },
  { value: "other", label: "Diğer" },
];

const CLAIM_STAKE_AMOUNT = "0.5";

function FieldLabel({ label, helper }: { label: string; helper?: string }) {
  return (
    <label className="mb-1.5 block">
      <span className="block text-sm font-semibold text-slate-200">{label}</span>
      {helper && <span className="mt-0.5 block text-xs text-slate-500">{helper}</span>}
    </label>
  );
}

export default function ClaimForm({ walletAddress, walletConnected, onClaimCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [category, setCategory] = useState("other");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");

  const stakeMode = getStakeMode();
  const modeLabel = stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo";

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setIncidentDate("");
    setIncidentTime("");
    setCategory("other");
    setError("");
    setLoadingMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim()) {
      setError("Başlık ve açıklama zorunludur.");
      return;
    }

    if (!walletConnected) {
      setError("XLM stake için önce Freighter cüzdanınızı bağlamalısınız.");
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
      setLoadingMsg("Bildirim analiz ediliyor...");
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        incidentDate,
        incidentTime,
        category,
      };

      const aiResult: AIReport = await analyzeClaim(payload);
      const createdAt = new Date().toISOString();
      const creatorWallet = walletAddress;
      const claimHash = await buildClaimHash({ ...payload, creatorWallet, createdAt });
      const aiReportHash = await buildAiReportHash(aiResult);
      const claimId = crypto.randomUUID();
      let stakeTxHash = "";

      setLoadingMsg("XLM stake işlemi bekleniyor...");

      if (stakeMode === "soroban") {
        try {
          const result = await sorobanCreateClaimWithStake(walletAddress, claimId, claimHash, aiReportHash);
          if (!result.success) {
            throw new Error("Soroban escrow stake işlemi başarısız oldu.");
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
          amount: CLAIM_STAKE_AMOUNT,
          memoText: "PW-CLAIM",
        });

        if (!stakeResult.successful) {
          throw new Error("Stake transaction başarısız oldu.");
        }

        stakeTxHash = stakeResult.hash;
      } else {
        // Bu noktaya asılırsa VITE_STAKE_MODE yanlış tanımlanmış demektir
        throw new Error("Geçersiz stake modu. Claim oluşturulamadı.");
      }

      const claim: Claim = {
        id: claimId,
        ...payload,
        creatorWallet,
        ai: aiResult,
        status: "Needs Evidence",
        createdAt,
        claimHash,
        aiReportHash,
        verifications: [],
        stakeAmount: CLAIM_STAKE_AMOUNT,
        stakeTxHash,
        rewardCredits: 0,
        rewardsDistributed: false,
        stakeMode,
      };

      onClaimCreated(claim);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bildirim analiz edilemedi.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  return (
    <section className="section-card p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Bildirim Oluştur</h2>
          <p className="mt-1 text-xs text-slate-400">
            Formlar demo için boş başlar; iddianın bağlamını net girin.
          </p>
        </div>
        <span className="badge border border-indigo-400/25 bg-indigo-500/10 text-indigo-200">
          <Coins className="h-3.5 w-3.5" />
          {CLAIM_STAKE_AMOUNT} XLM
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3">
          <p className="text-xs leading-relaxed text-indigo-100">
            Bildirim gönderildiğinde AI risk analizi çalışır ve ardından Freighter ile{" "}
            <span className="font-semibold">{CLAIM_STAKE_AMOUNT} testnet XLM</span> stake imzalanır.
            <span className="ml-1 text-indigo-200/70">({modeLabel})</span>
          </p>
        </div>

        <div>
          <FieldLabel label="Olay başlığı" helper="Kısa, açık ve doğrulanabilir yazın." />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Ana yolda geçici kapanma bildirimi"
            className="input-field"
            disabled={loading}
          />
        </div>

        <div>
          <FieldLabel label="Açıklama" helper="Ne olduğu, kimlerin etkilenebileceği ve gözlem bağlamı." />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="İddianın detaylarını yazın"
            rows={5}
            className="input-field resize-none"
            disabled={loading}
          />
        </div>

        <div>
          <FieldLabel label="Konum" helper="Mahalle, cadde, tesis veya yaklaşık bölge." />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Konum girin"
            className="input-field"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel label="Tarih" />
            <input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="input-field"
              disabled={loading}
            />
          </div>
          <div>
            <FieldLabel label="Saat" />
            <input
              type="time"
              value={incidentTime}
              onChange={(e) => setIncidentTime(e.target.value)}
              className="input-field"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <FieldLabel label="Kategori" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
            disabled={loading}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <p className="text-sm text-red-100">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingMsg || "İşlem devam ediyor..."}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              0.5 testnet XLM stake ile bildirimi oluştur
            </>
          )}
        </button>
      </form>
    </section>
  );
}
