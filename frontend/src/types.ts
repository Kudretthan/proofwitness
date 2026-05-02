export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type ClaimStatus = "Needs Evidence" | "Verified" | "False / Disputed";

export type VerificationDecision = "true" | "false" | "unsure";

export type AIReport = {
  riskLevel: RiskLevel;
  confidence: number;
  summary: string;
  signals: string[];
  suggestedAction: string;
  source: "gemini" | "fallback";
};

export type Verification = {
  id: string;
  claimId: string;
  verifierWallet: string;
  decision: VerificationDecision;
  note: string;
  evidenceUrl?: string;
  createdAt: string;
  verificationHash?: string;
  stakeAmount: string;
  stakeTxHash?: string;
  rewardCredits: number;
};

export type Claim = {
  id: string;
  title: string;
  description: string;
  location: string;
  incidentDate: string;
  incidentTime: string;
  category: string;
  creatorWallet: string;
  ai: AIReport;
  status: ClaimStatus;
  createdAt: string;
  claimHash?: string;
  aiReportHash?: string;
  verifications: Verification[];
  stakeAmount: string;
  stakeTxHash?: string;
  rewardCredits: number;
  rewardsDistributed?: boolean;
  stakeMode?: "treasury" | "soroban";
  escrowPayoutDone?: boolean;
};

export type CreditLedger = Record<string, number>;
