import { useState } from "react";
import { Send, Loader2, AlertTriangle, Coins } from "lucide-react";
import { analyzeClaim } from "../lib/api";
import { buildClaimHash, buildAiReportHash } from "../lib/hash";
import { stakeXlmWithFreighter, getTreasuryAddress } from "../lib/stellarStake";
import {
  getStakeMode,
  isSorobanReady,
  getSorobanConfigError,
  sorobanCreateClaimWithStake,
} from "../lib/sorobanEscrow";
import type { Claim, AIReport } from "../types";

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
      // 1. AI Analiz (her iki mod için ortak)
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

      const claimHash = await buildClaimHash({
        ...payload,
        creatorWallet,
        createdAt,
      });

      const aiReportHash = await buildAiReportHash(aiResult);
      const claimId = crypto.randomUUID();

      // 2. Stake (mode-dependent)
      let stakeTxHash = "";

      if (stakeMode === "soroban") {
        setLoadingMsg("Soroban escrow stake işlemi bekleniyor...");
        try {
          const result = await sorobanCreateClaimWithStake(
            walletAddress,
            claimId,
            claimHash,
            aiReportHash
          );
          if (!result.success) {
            throw new Error("Soroban escrow stake işlemi başarısız oldu.");
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
          amount: CLAIM_STAKE_AMOUNT,
          memoText: "PW-CLAIM",
        });

        if (!stakeResult.successful) {
          throw new Error("Stake transaction başarısız oldu.");
        }
        stakeTxHash = stakeResult.hash;
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

  const modeLabel = stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stake bilgisi */}
      <div className="flex items-center gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-3">
        <Coins className="w-4 h-4 text-indigo-400 shrink-0" />
        <p className="text-[11px] text-indigo-300">
          Bildirim oluşturmak için <span className="font-semibold">{CLAIM_STAKE_AMOUNT} testnet XLM</span> stake edilir.
          <span className="ml-1 text-[10px] text-indigo-400/70">({modeLabel})</span>
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Olay Başlığı
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Kısa bir başlık girin"
          className="input-field"
          disabled={loading}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Açıklama
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="İddianın detaylarını yazın"
          rows={4}
          className="input-field resize-none"
          disabled={loading}
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Konum
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Konum girin"
          className="input-field"
          disabled={loading}
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Tarih
          </label>
          <input
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
            className="input-field"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Saat
          </label>
          <input
            type="time"
            value={incidentTime}
            onChange={(e) => setIncidentTime(e.target.value)}
            className="input-field"
            disabled={loading}
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Kategori
        </label>
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

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingMsg || "İşlem devam ediyor..."}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Bildirimi Gönder
          </>
        )}
      </button>
    </form>
  );
}
