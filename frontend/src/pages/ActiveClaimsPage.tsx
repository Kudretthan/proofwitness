import { Inbox } from "lucide-react";
import ClaimCard from "../components/ClaimCard";
import type { Claim, CreditLedger, Verification } from "../types";

type Props = {
  claims: Claim[];
  walletAddress: string;
  walletConnected: boolean;
  creditLedger: CreditLedger;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
  onPayoutDone?: (claimId: string, payoutTxHash: string) => void;
};

export default function ActiveClaimsPage({
  claims,
  walletAddress,
  walletConnected,
  creditLedger,
  onVerificationAdded,
  onPayoutDone,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-50">Aktif Bildirimler</h1>
        <p className="mt-2 text-slate-400">Doğrulanmayı bekleyen kriz bildirimleri.</p>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-14 text-center">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">Şu anda doğrulanmayı bekleyen bildirim yok.</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={onVerificationAdded}
              onPayoutDone={onPayoutDone}
              mode="full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
