import ClaimForm from "../components/ClaimForm";
import SystemNotice from "../components/SystemNotice";
import { useNavigate } from "react-router-dom";
import type { Claim } from "../types";

type Props = {
  walletAddress: string;
  walletConnected: boolean;
  onClaimCreated: (claim: Claim) => void;
};

export default function CreateClaimPage({ walletAddress, walletConnected, onClaimCreated }: Props) {
  const navigate = useNavigate();

  const handleCreated = (claim: Claim) => {
    onClaimCreated(claim);
    navigate("/active");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-50">Bildirim Oluştur</h1>
        <p className="mt-2 text-slate-400">Yeni bir kriz iddiasını sisteme kaydedin.</p>
      </div>

      <div className="space-y-4">
        <SystemNotice title="0.5 Testnet XLM Stake Gerektirir">
          Bildirimi oluştururken cüzdanınızdan 0.5 XLM stake imzası istenir. Bu stake Soroban escrow sözleşmesinde veya treasury adresinde tutulur.
        </SystemNotice>
        <SystemNotice title="Otomatik AI Analizi" tone="violet">
          Bildiriminiz gönderildiğinde anında AI (Gemini) risk analizinden geçer ve sisteme kaydedilir.
        </SystemNotice>
      </div>

      <ClaimForm
        walletAddress={walletAddress}
        walletConnected={walletConnected}
        onClaimCreated={handleCreated}
      />
    </div>
  );
}
