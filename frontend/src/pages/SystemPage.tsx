import { useState, useEffect } from "react";
import { AlertCircle, Trash2, Database, Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import SystemNotice from "../components/SystemNotice";
import { isSupabaseConfigured, hasSupabaseUrl, hasSupabaseKey } from "../lib/supabase";
import { checkContractInitialized, sorobanInitContract } from "../lib/sorobanEscrow";

type Props = {
  stakeMode: "soroban" | "treasury";
  sorobanConfigErr: string | null;
  onClearData: () => void;
  supabaseError?: boolean;
  walletAddress: string;
  walletConnected: boolean;
};

export default function SystemPage({
  stakeMode,
  sorobanConfigErr,
  onClearData,
  supabaseError,
  walletAddress,
  walletConnected,
}: Props) {
  const [contractInitialized, setContractInitialized] = useState<boolean | null>(null);
  const [checkingInit, setCheckingInit] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState<{ success: boolean; message: string } | null>(null);

  const envStakeMode = import.meta.env.VITE_STAKE_MODE;
  const hasEscrowId = !!import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID;
  const hasXlmId = !!import.meta.env.VITE_XLM_TOKEN_CONTRACT_ID;
  const hasRpcUrl = !!import.meta.env.VITE_STELLAR_RPC_URL;
  const allEnvsOk = hasEscrowId && hasXlmId && hasRpcUrl;

  useEffect(() => {
    if (stakeMode === "soroban" && allEnvsOk) {
      setCheckingInit(true);
      checkContractInitialized()
        .then((ok) => setContractInitialized(ok))
        .finally(() => setCheckingInit(false));
    }
  }, [stakeMode, allEnvsOk]);

  const handleInit = async () => {
    if (!walletConnected) {
      setInitResult({ success: false, message: "Önce Freighter cüzdanınızı bağlayın." });
      return;
    }
    setInitLoading(true);
    setInitResult(null);
    const result = await sorobanInitContract(walletAddress);
    setInitLoading(false);
    if (result.success) {
      setContractInitialized(true);
      setInitResult({ success: true, message: `Contract başarıyla initialize edildi. TX: ${result.txHash}` });
    } else {
      const msg = result.error || "Bilinmeyen hata";
      if (msg.includes("already initialized") || msg.includes("zaten initialize")) {
        setContractInitialized(true);
        setInitResult({ success: true, message: "Contract zaten initialize edilmiş." });
      } else {
        setInitResult({ success: false, message: msg });
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-50">Sistem & Soroban</h1>
        <p className="mt-2 text-slate-400">
          Bu MVP'de XLM stake işlemleri Freighter ile imzalanır. Soroban Escrow modunda stake'ler akıllı sözleşme mantığıyla kilitlenir ve sonuçlandığında kazanan taraflara iade edilebilir.
        </p>
      </div>

      <section className="section-card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-100">Teknik Bilgiler</h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">Stake Modu (VITE_STAKE_MODE)</span>
            <span className="font-bold text-slate-100">{envStakeMode || "Belirtilmemiş (Varsayılan: treasury)"}</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">Ağ (VITE_STELLAR_NETWORK)</span>
            <span className="font-bold text-slate-100">{import.meta.env.VITE_STELLAR_NETWORK || "Belirtilmemiş"}</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_SOROBAN_ESCROW_CONTRACT_ID tanımlı mı?</span>
            <span className={hasEscrowId ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {hasEscrowId ? "Evet" : "Hayır"}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_XLM_TOKEN_CONTRACT_ID tanımlı mı?</span>
            <span className={hasXlmId ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {hasXlmId ? "Evet" : "Hayır"}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_STELLAR_RPC_URL tanımlı mı?</span>
            <span className={hasRpcUrl ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {hasRpcUrl ? "Evet" : "Hayır"}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">Treasury Fallback Address</span>
            <span className="font-mono text-xs font-bold text-slate-100">{import.meta.env.VITE_STAKE_TREASURY_ADDRESS || "Belirtilmemiş"}</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">Backend API URL</span>
            <span className="font-mono text-xs font-bold text-slate-100">{import.meta.env.VITE_API_URL || "Belirtilmemiş"}</span>
          </div>
        </div>

        {stakeMode === "soroban" && sorobanConfigErr && (
          <div className="mt-4">
            <SystemNotice title="Soroban yapılandırma hatası" tone="red">
              {sorobanConfigErr}
            </SystemNotice>
          </div>
        )}
        {stakeMode === "soroban" && !allEnvsOk && (
          <div className="mt-4">
            <SystemNotice title="Eksik Çevre Değişkenleri" tone="red">
              Soroban Escrow modunun çalışabilmesi için ilgili tüm değişkenlerin (.env) tanımlanmış olması zorunludur.
            </SystemNotice>
          </div>
        )}
      </section>

      {/* ─── Soroban Contract Init Panel ─── */}
      {stakeMode === "soroban" && allEnvsOk && (
        <section className="section-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-5 w-5 text-violet-300" />
            <h2 className="text-xl font-bold text-slate-100">Soroban Contract Durumu</h2>
          </div>

          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">Contract Initialize Durumu</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Contract deploy edildikten sonra bir kez <code className="text-violet-300">init(admin, xlm_token)</code> çağrısı yapılması gerekir.
                </p>
              </div>
              {checkingInit ? (
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Kontrol ediliyor...
                </span>
              ) : contractInitialized === true ? (
                <span className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Initialize edilmiş
                </span>
              ) : contractInitialized === false ? (
                <span className="flex items-center gap-2 text-sm font-bold text-red-400">
                  <XCircle className="h-4 w-4" /> Initialize edilmemiş
                </span>
              ) : (
                <span className="text-sm text-slate-500">Bilinmiyor</span>
              )}
            </div>
          </div>

          {contractInitialized === false && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 mb-4">
              <p className="text-sm text-amber-100">
                ⚠️ Contract initialize edilmemiş. Aşağıdaki butona tıklayarak Freighter cüzdanınızla <strong>admin</strong> olarak init işlemini başlatın. Bu işlemi yalnızca bir kez yapmanız yeterlidir.
              </p>
            </div>
          )}

          {contractInitialized !== true && (
            <button
              onClick={handleInit}
              disabled={initLoading || !walletConnected}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {initLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initialize ediliyor...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {walletConnected ? "Contract'ı Initialize Et (Freighter)" : "Önce cüzdanı bağlayın"}
                </>
              )}
            </button>
          )}

          {initResult && (
            <div
              className={`mt-3 rounded-xl border p-3 text-sm ${
                initResult.success
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-red-400/25 bg-red-500/10 text-red-100"
              }`}
            >
              {initResult.message}
            </div>
          )}
        </section>
      )}

      <section className="section-card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-100">Veri Yönetimi</h2>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-start gap-4">
            <Database className="mt-1 h-6 w-6 shrink-0 text-blue-400" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Veri Modu: {isSupabaseConfigured
                    ? supabaseError
                      ? "Supabase bağlantı hatası - LocalStorage fallback"
                      : "Supabase"
                    : "LocalStorage"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {isSupabaseConfigured && !supabaseError
                    ? "Bu modda bildirimler tüm kullanıcılar arasında paylaşılır."
                    : "Bu modda kayıtlar sadece bu tarayıcıda görünür."}
                </p>
              </div>
              
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Supabase URL tanımlı mı:</span>
                  <span className={hasSupabaseUrl ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
                    {hasSupabaseUrl ? "Evet" : "Hayır"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Supabase Key tanımlı mı:</span>
                  <span className={hasSupabaseKey ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
                    {hasSupabaseKey ? "Evet" : "Hayır"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-red-400" />
            <div>
              <h3 className="text-base font-bold text-red-200">Yerel Verileri Temizle</h3>
              <p className="mt-1 text-sm text-red-300/80">
                Bu işlem tarayıcınızda kayıtlı olan tüm bildirimleri, itibar kredilerini ve diğer yerel önbellek verilerini siler. Blockchain üzerindeki veriler veya cüzdan bakiyeniz etkilenmez.
              </p>
              <button
                onClick={onClearData}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/30 transition"
              >
                <Trash2 className="h-4 w-4" />
                Yerel verileri sil
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-100">Bağlantılar</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://github.com/Kudretthan/proofwitness"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
          >
            GitHub Deposu
          </a>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
          >
            Escrow Contract (Explorer)
          </a>
          <a
            href="https://stellar.expert/explorer/testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
          >
            Stellar Expert Testnet
          </a>
        </div>
      </section>
    </div>
  );
}
