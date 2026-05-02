import { AlertCircle, Trash2, Database } from "lucide-react";
import SystemNotice from "../components/SystemNotice";
import { isSupabaseConfigured, hasSupabaseUrl, hasSupabaseKey } from "../lib/supabase";

type Props = {
  stakeMode: "soroban" | "treasury";
  sorobanConfigErr: string | null;
  onClearData: () => void;
  supabaseError?: boolean;
};

export default function SystemPage({ stakeMode, sorobanConfigErr, onClearData, supabaseError }: Props) {
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
            <span className="font-bold text-slate-100">{import.meta.env.VITE_STAKE_MODE || "Belirtilmemiş (Varsayılan: treasury)"}</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">Ağ (VITE_STELLAR_NETWORK)</span>
            <span className="font-bold text-slate-100">{import.meta.env.VITE_STELLAR_NETWORK || "Belirtilmemiş"}</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_SOROBAN_ESCROW_CONTRACT_ID tanımlı mı?</span>
            <span className={import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID ? "Evet" : "Hayır"}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_XLM_TOKEN_CONTRACT_ID tanımlı mı?</span>
            <span className={import.meta.env.VITE_XLM_TOKEN_CONTRACT_ID ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {import.meta.env.VITE_XLM_TOKEN_CONTRACT_ID ? "Evet" : "Hayır"}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-400">VITE_STELLAR_RPC_URL tanımlı mı?</span>
            <span className={import.meta.env.VITE_STELLAR_RPC_URL ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
              {import.meta.env.VITE_STELLAR_RPC_URL ? "Evet" : "Hayır"}
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
        {stakeMode === "soroban" &&
          (!import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID ||
            !import.meta.env.VITE_XLM_TOKEN_CONTRACT_ID ||
            !import.meta.env.VITE_STELLAR_RPC_URL) && (
            <div className="mt-4">
              <SystemNotice title="Eksik Çevre Değişkenleri" tone="red">
                Soroban Escrow modunun çalışabilmesi için ilgili tüm değişkenlerin (.env) tanımlanmış olması zorunludur.
              </SystemNotice>
            </div>
          )}
      </section>

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
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
          >
            GitHub Deposu
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
