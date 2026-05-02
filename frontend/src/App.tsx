import { useState, useCallback, useEffect } from "react";
import {
  Shield,
  Users,
  Clock,
  Hash,
  Coins,
  Bot,
  AlertTriangle,
  Info,
  Sparkles,
  Wallet,
  Award,
  FileCheck,
  BarChart3,
  ShieldCheck,
  List,
  Lock,
} from "lucide-react";
import WalletSummary from "./components/WalletSummary";
import ClaimForm from "./components/ClaimForm";
import ClaimList from "./components/ClaimList";
import { connectWallet, tryAutoConnect } from "./lib/wallet";
import type { WalletState } from "./lib/wallet";
import { getTreasuryAddress } from "./lib/stellarStake";
import { getStakeMode, getSorobanConfigError } from "./lib/sorobanEscrow";
import { shortAddress } from "./lib/wallet";
import type { Claim, ClaimStatus, Verification, CreditLedger } from "./types";

/* ─── LocalStorage Keys ─── */
const LS_CLAIMS = "proofwitness_claims";
const LS_CREDITS = "proofwitness_credit_ledger";

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — ignore silently
  }
}

function computeStatus(verifications: Verification[]): ClaimStatus {
  const trueCount = verifications.filter((v) => v.decision === "true").length;
  const falseCount = verifications.filter((v) => v.decision === "false").length;
  if (trueCount >= 3) return "Verified";
  if (falseCount >= 2) return "False / Disputed";
  return "Needs Evidence";
}

const FEATURES = [
  { icon: <Bot className="w-5 h-5" />, label: "Yapay zekâ risk analizi" },
  { icon: <Users className="w-5 h-5" />, label: "İnsan doğrulaması" },
  { icon: <Clock className="w-5 h-5" />, label: "Kanıt akışı" },
  { icon: <Hash className="w-5 h-5" />, label: "Stellar'a hazır hashler" },
  { icon: <Coins className="w-5 h-5" />, label: "Testnet XLM stake" },
];

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    installed: false,
    connected: false,
    publicKey: "",
    network: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [claims, setClaims] = useState<Claim[]>(() => loadFromLS<Claim[]>(LS_CLAIMS, []));
  const [creditLedger, setCreditLedger] = useState<CreditLedger>(() => loadFromLS<CreditLedger>(LS_CREDITS, {}));

  const walletConnected = wallet.connected;
  const walletAddress = walletConnected ? wallet.publicKey : "not-connected";
  const userCredits = creditLedger[walletAddress] || 0;
  const treasury = getTreasuryAddress();
  const stakeMode = getStakeMode();
  const sorobanConfigErr = stakeMode === "soroban" ? getSorobanConfigError() : null;

  /* ─── Persist to localStorage ─── */
  useEffect(() => { saveToLS(LS_CLAIMS, claims); }, [claims]);
  useEffect(() => { saveToLS(LS_CREDITS, creditLedger); }, [creditLedger]);

  /* ─── Auto-reconnect Freighter on mount ─── */
  useEffect(() => {
    tryAutoConnect().then((state) => {
      if (state.connected) setWallet(state);
    });
  }, []);

  /* ─── Wallet ─── */
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setWalletError("");
    try {
      const state = await connectWallet();
      setWallet(state);
      if (!state.installed) {
        setWalletError("Freighter cüzdanı yüklü değil. Lütfen freighter.app adresinden yükleyin.");
      } else if (!state.connected) {
        setWalletError("Freighter'a bağlanılamadı. Lütfen tekrar deneyin.");
      }
    } catch {
      setWalletError("Freighter'a bağlanırken bir hata oluştu.");
    } finally {
      setConnecting(false);
    }
  }, []);

  /* ─── Credit Distribution ─── */
  const distributeCredits = useCallback(
    (claim: Claim, newStatus: ClaimStatus): { updatedClaim: Claim; ledgerDelta: CreditLedger } => {
      const ledgerDelta: CreditLedger = {};
      let updatedVerifications = [...claim.verifications];
      let claimRewardCredits = 0;

      if (newStatus === "Verified") {
        // Doğru diyenlere +10, claim creator'a +5
        updatedVerifications = updatedVerifications.map((v) => {
          if (v.decision === "true") {
            ledgerDelta[v.verifierWallet] = (ledgerDelta[v.verifierWallet] || 0) + 10;
            return { ...v, rewardCredits: 10 };
          }
          return v;
        });
        ledgerDelta[claim.creatorWallet] = (ledgerDelta[claim.creatorWallet] || 0) + 5;
        claimRewardCredits = 5;
      } else if (newStatus === "False / Disputed") {
        // Yanlış diyenlere +10, creator'a kredi yok
        updatedVerifications = updatedVerifications.map((v) => {
          if (v.decision === "false") {
            ledgerDelta[v.verifierWallet] = (ledgerDelta[v.verifierWallet] || 0) + 10;
            return { ...v, rewardCredits: 10 };
          }
          return v;
        });
      }

      const updatedClaim: Claim = {
        ...claim,
        verifications: updatedVerifications,
        rewardCredits: claimRewardCredits,
        rewardsDistributed: true,
        status: newStatus,
      };

      return { updatedClaim, ledgerDelta };
    },
    []
  );

  /* ─── Claims ─── */
  const handleClaimCreated = useCallback((claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
  }, []);

  const handleVerificationAdded = useCallback(
    (claimId: string, verification: Verification) => {
      setClaims((prev) =>
        prev.map((c) => {
          if (c.id !== claimId) return c;

          const updatedVerifications = [...c.verifications, verification];
          const newStatus = computeStatus(updatedVerifications);
          const oldStatus = c.status;

          // Status değişti ve henüz reward dağıtılmadıysa
          if (
            oldStatus === "Needs Evidence" &&
            (newStatus === "Verified" || newStatus === "False / Disputed") &&
            !c.rewardsDistributed
          ) {
            const tempClaim = { ...c, verifications: updatedVerifications };
            const { updatedClaim, ledgerDelta } = distributeCredits(tempClaim, newStatus);

            // Credit ledger güncelle
            setCreditLedger((prevLedger) => {
              const newLedger = { ...prevLedger };
              for (const [wallet, credits] of Object.entries(ledgerDelta)) {
                newLedger[wallet] = (newLedger[wallet] || 0) + credits;
              }
              return newLedger;
            });

            return updatedClaim;
          }

          return {
            ...c,
            verifications: updatedVerifications,
            status: newStatus,
          };
        })
      );
    },
    [distributeCredits]
  );

  /* ─── Clear local data ─── */
  const handleClearData = useCallback(() => {
    const ok = window.confirm("Tüm yerel bildirimleri ve kredileri silmek istediğinize emin misiniz?");
    if (!ok) return;
    localStorage.removeItem(LS_CLAIMS);
    localStorage.removeItem(LS_CREDITS);
    setClaims([]);
    setCreditLedger({});
  }, []);

  /* ─── Soroban Payout Done ─── */
  const handlePayoutDone = useCallback((claimId: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, escrowPayoutDone: true } : c))
    );
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* ───────── Navigation ───────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-surface)]/80 border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-indigo-400" />
            <span className="text-xl font-bold gradient-text">ProofWitness</span>
          </div>
          <WalletSummary
            wallet={wallet}
            onConnect={handleConnect}
            connecting={connecting}
            userCredits={userCredits}
            onClearData={handleClearData}
          />
        </div>
      </nav>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 right-0 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
              <span className="gradient-text">Kriz iddiaları paniğe değil,</span>
              <br />
              <span className="text-gray-100">kanıta ihtiyaç duyar.</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Bir iddia oluşturun, yapay zekâ yanlış bilgi riskini analiz etsin,
              bölgedeki insanlar kanıtla doğrulasın veya yanlışlasın.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-full px-4 py-2 text-sm text-gray-300 hover:border-indigo-500/40 transition-colors"
              >
                <span className="text-indigo-400">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Wallet error ───────── */}
      {walletError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{walletError}</p>
          </div>
        </div>
      )}

      {/* ───────── Wallet info card ───────── */}
      {!walletConnected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center gap-3 bg-indigo-500/8 border border-indigo-500/20 rounded-2xl p-4">
            <Wallet className="w-5 h-5 text-indigo-400 shrink-0" />
            <p className="text-sm text-indigo-300">
              XLM stake ve kredi takibi için Freighter cüzdanınızı bağlayın.
            </p>
          </div>
        </div>
      )}

      {/* ───────── Treasury uyarıları ───────── */}
      {walletConnected && stakeMode === "treasury" && !treasury && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              Stake treasury adresi tanımlı değil. <code className="text-red-200">VITE_STAKE_TREASURY_ADDRESS</code> env değişkenini ayarlayın.
            </p>
          </div>
        </div>
      )}

      {walletConnected && stakeMode === "treasury" && treasury && treasury === walletAddress && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              Stake treasury adresi bağlı cüzdan ile aynı. Demo için ayrı bir Testnet treasury cüzdanı kullanmanız önerilir.
            </p>
          </div>
        </div>
      )}

      {/* ───────── Soroban uyarıları ───────── */}
      {walletConnected && stakeMode === "soroban" && sorobanConfigErr && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">{sorobanConfigErr}</p>
          </div>
        </div>
      )}

      {/* ───────── Info banners ───────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 mb-8">
        {/* Stake Mode Göstergesi */}
        <div className={`flex items-start gap-3 rounded-2xl p-4 border ${
          stakeMode === "soroban"
            ? "bg-violet-500/10 border-violet-500/30"
            : "bg-[var(--color-surface-card)] border-[var(--color-border)]"
        }`}>
          <Lock className={`w-5 h-5 shrink-0 mt-0.5 ${
            stakeMode === "soroban" ? "text-violet-400" : "text-gray-500"
          }`} />
          <div className="text-sm">
            <p className={stakeMode === "soroban" ? "text-violet-200 font-medium" : "text-gray-200 font-medium"}>
              Stake modu: {stakeMode === "soroban" ? "Soroban Escrow" : "Treasury Demo"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {stakeMode === "soroban"
                ? "Soroban Escrow modunda XLM, demo treasury hesabına değil akıllı sözleşmeye kilitlenir. Bildirim doğrulanırsa doğru katkı yapanların stake'i iade edilir. Bildirim yanlışlanırsa yanlış bilgiyi destekleyenlerin stake'i geri verilmez."
                : "Treasury Demo modunda stake ödemeleri demo treasury hesabına gönderilir. Soroban Escrow modu için .env dosyasında VITE_STAKE_MODE=soroban olarak değiştirin."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-400">
            <span className="text-gray-200 font-medium">Yapay zekâ gerçeğe tek başına karar vermez.</span>{" "}
            Doğrulamaya yardımcı olur; hesap verebilirliği insanlar ve Stellar sağlar.
          </p>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <Coins className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p>
              <span className="text-gray-200 font-medium">XLM Stake:</span>{" "}
              Bildirim: 0.5 testnet XLM · Doğrulama: 0.1 testnet XLM
            </p>
            <p className="mt-1 text-xs">
              XLM stake, spam ve sahte doğrulamayı maliyetli hale getirir. Kredi sistemi ise doğru katkı
              yapan kullanıcıların itibarını artırır.
              {stakeMode === "soroban"
                ? " Soroban Escrow modunda stake doğrudan akıllı sözleşmeye kilitlenir ve doğrulama sonucuna göre otomatik iade edilir."
                : " Bu MVP'de krediler uygulama içinde tutulur."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p>
              <span className="text-gray-200 font-medium">İtibar Kredisi:</span>{" "}
              Doğrulandı → doğru diyenlere +10, bildirimi oluşturana +5 itibar kredisi.
              Yanlış / İtiraz Edildi → yanlış diyenlere +10 itibar kredisi.
            </p>
            <p className="mt-1 text-xs">
              İtibar kredisi, doğru çıkan doğrulamalardan kazanılır ve Freighter cüzdan adresinize bağlıdır.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <ShieldCheck className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p className="text-gray-200 font-medium">İtibar kredisi ne işe yarar?</p>
            <ul className="mt-1.5 space-y-1 text-xs list-disc list-inside">
              <li>Güvenilir doğrulayıcı rozetleri sağlar.</li>
              <li>Gelecekte oy ağırlığı ve daha düşük stake için kullanılabilir.</li>
              <li>Soroban escrow ile XLM ödül/ceza sistemine bağlanabilir.</li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] border rounded-full px-2 py-0.5 bg-gray-500/15 border-gray-500/30 text-gray-400">0-19: Yeni Tanık</span>
              <span className="text-[10px] border rounded-full px-2 py-0.5 bg-emerald-500/15 border-emerald-500/30 text-emerald-300">20-49: Güvenilir Tanık</span>
              <span className="text-[10px] border rounded-full px-2 py-0.5 bg-cyan-500/15 border-cyan-500/30 text-cyan-300">50-99: Öncelikli Doğrulayıcı</span>
              <span className="text-[10px] border rounded-full px-2 py-0.5 bg-violet-500/15 border-violet-500/30 text-violet-300">100+: Topluluk Doğrulayıcısı</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <List className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Bu MVP'de itibar kredileri bu tarayıcıda saklanır. Üretim sürümünde bu itibar, cüzdan adresine bağlı şekilde zincir üstü veya merkeziyetsiz bir veri katmanında tutulabilir.
          </p>
        </div>

        <div className="flex items-start gap-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-4">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p>
              <span className="text-gray-200 font-medium">Bu sürüm Testnet üzerinde çalışır. Gerçek para kullanılmaz.</span>
            </p>
            <p className="mt-1 text-xs">
              {stakeMode === "soroban"
                ? "Stake ödemeleri Soroban escrow akıllı sözleşmesine kilitlenir. Doğrulama sonucuna göre kazanan tarafa otomatik iade edilir."
                : `Stake ödemeleri demo treasury hesabına (${treasury ? shortAddress(treasury) : "tanımlı değil"}) gönderilir. Otomatik iade/slashing için Soroban escrow modunu etkinleştirin.`}
            </p>
          </div>
        </div>
      </div>

      {/* ───────── Dashboard Stats ───────── */}
      {(() => {
        const totalClaims = claims.length;
        const needsEvidence = claims.filter((c) => c.status === "Needs Evidence").length;
        const verified = claims.filter((c) => c.status === "Verified").length;
        const disputed = claims.filter((c) => c.status === "False / Disputed").length;
        const totalVerifications = claims.reduce((sum, c) => sum + c.verifications.length, 0);
        const totalStaked = claims.reduce((sum, c) => {
          const claimStake = parseFloat(c.stakeAmount) || 0;
          const verStake = c.verifications.reduce(
            (vs, v) => vs + (parseFloat(v.stakeAmount) || 0),
            0
          );
          return sum + claimStake + verStake;
        }, 0);

        const stats = [
          { label: "Toplam Bildirim", value: totalClaims, icon: <BarChart3 className="w-5 h-5" />, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
          { label: "Kanıt Bekleyen", value: needsEvidence, icon: <Clock className="w-5 h-5" />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Doğrulanan", value: verified, icon: <FileCheck className="w-5 h-5" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Yanlış / İtiraz", value: disputed, icon: <AlertTriangle className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Toplam Doğrulama", value: totalVerifications, icon: <Users className="w-5 h-5" />, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { label: "Stake Edilen XLM", value: totalStaked.toFixed(1), icon: <Coins className="w-5 h-5" />, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
        ];

        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 flex flex-col items-center text-center gap-1.5 transition-all hover:scale-[1.03] ${s.bg}`}
                >
                  <span className={s.color}>{s.icon}</span>
                  <span className="text-2xl font-bold text-gray-100">{s.value}</span>
                  <span className="text-[11px] text-gray-400 leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ───────── Main content ───────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Create Claim */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 card-glow">
              <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Bildirim Oluştur
              </h2>
              <ClaimForm
                walletAddress={walletAddress}
                walletConnected={walletConnected}
                onClaimCreated={handleClaimCreated}
              />
            </div>
          </div>

          {/* Right: Claims Board */}
          <div className="lg:col-span-8">
            <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Bildirim Panosu
              {claims.length > 0 && (
                <span className="ml-2 badge bg-[var(--color-surface-card)] text-gray-400 border border-[var(--color-border)]">
                  {claims.length}
                </span>
              )}
            </h2>
            <ClaimList
              claims={claims}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={handleVerificationAdded}
              onPayoutDone={handlePayoutDone}
            />
          </div>
        </div>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-gray-600">
            ProofWitness — Stellar Hackathon MVP · Yapay zekâ destekli kriz
            doğrulaması · Testnet XLM Stake
          </p>
        </div>
      </footer>
    </div>
  );
}
