import { useState } from "react";
import { Inbox } from "lucide-react";
import ClaimCard from "./ClaimCard";
import type { Claim, CreditLedger, Verification } from "../types";

type Props = {
  claims: Claim[];
  walletAddress: string;
  walletConnected: boolean;
  creditLedger: CreditLedger;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
  onPayoutDone?: (claimId: string) => void;
};

type BoardTab = "active" | "verified" | "disputed";

export default function ClaimList({
  claims,
  walletAddress,
  walletConnected,
  creditLedger,
  onVerificationAdded,
  onPayoutDone,
}: Props) {
  const [boardTab, setBoardTab] = useState<BoardTab>("active");

  const activeClaims = claims.filter((c) => c.status === "Needs Evidence");
  const verifiedClaims = claims.filter((c) => c.status === "Verified");
  const disputedClaims = claims.filter((c) => c.status === "False / Disputed");

  const renderSection = (
    title: string,
    description: string,
    sectionClaims: Claim[],
    emptyMessage: string
  ) => (
    <section className="section-card p-5 lg:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      {sectionClaims.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center">
          <Inbox className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">{emptyMessage}</h3>
        </div>
      ) : (
        <div className="space-y-5">
          {sectionClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={onVerificationAdded}
              onPayoutDone={onPayoutDone}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBoardTab("active")}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
            boardTab === "active"
              ? "border-indigo-300/40 bg-indigo-500/20 text-indigo-100"
              : "border-slate-700/70 bg-slate-950/30 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          }`}
        >
          Aktif Bildirimler
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-800/80 px-2 text-xs font-bold text-slate-300">
            {activeClaims.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBoardTab("verified")}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
            boardTab === "verified"
              ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
              : "border-slate-700/70 bg-slate-950/30 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          }`}
        >
          Doğrulananlar
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-800/80 px-2 text-xs font-bold text-slate-300">
            {verifiedClaims.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBoardTab("disputed")}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
            boardTab === "disputed"
              ? "border-red-300/40 bg-red-500/20 text-red-100"
              : "border-slate-700/70 bg-slate-950/30 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          }`}
        >
          Yanlışlananlar
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-800/80 px-2 text-xs font-bold text-slate-300">
            {disputedClaims.length}
          </span>
        </button>
      </div>

      {boardTab === "active" &&
        renderSection(
          "Bildirim Panosu",
          "Doğrulanmayı bekleyen aktif kriz bildirimleri.",
          activeClaims,
          "Şu anda doğrulanmayı bekleyen bildirim yok."
        )}
      {boardTab === "verified" &&
        renderSection(
          "Doğrulanan Bildirimler",
          "Topluluk doğrulamasıyla yeterli kanıt alan bildirimler.",
          verifiedClaims,
          "Henüz doğrulanmış bildirim yok."
        )}
      {boardTab === "disputed" &&
        renderSection(
          "Yanlışlanan Bildirimler",
          "Topluluk tarafından yanlış veya şüpheli olarak işaretlenen bildirimler.",
          disputedClaims,
          "Henüz yanlışlanmış bildirim yok."
        )}
    </div>
  );
}
