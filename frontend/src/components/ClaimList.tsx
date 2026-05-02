import { Inbox } from "lucide-react";
import ClaimCard from "./ClaimCard";
import type { Claim, Verification, CreditLedger } from "../types";

type Props = {
  claims: Claim[];
  walletAddress: string;
  walletConnected: boolean;
  creditLedger: CreditLedger;
  onVerificationAdded: (claimId: string, verification: Verification) => void;
  onPayoutDone?: (claimId: string) => void;
};

export default function ClaimList({ claims, walletAddress, walletConnected, creditLedger, onVerificationAdded, onPayoutDone }: Props) {
  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="w-12 h-12 text-gray-600 mb-4" />
        <p className="text-gray-400 text-sm">
          Henüz bildirim yok. İlk bildirimi oluşturmak için formu doldurun.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {claims.map((claim) => (
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
  );
}
