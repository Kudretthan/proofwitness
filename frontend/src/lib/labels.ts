import type { RiskLevel, ClaimStatus } from "../types";

export const riskLabels: Record<RiskLevel, string> = {
  Low: "Düşük",
  Medium: "Orta",
  High: "Yüksek",
  Critical: "Kritik",
};

export const statusLabels: Record<ClaimStatus, string> = {
  "Needs Evidence": "Kanıt Bekliyor",
  Verified: "Doğrulandı",
  "False / Disputed": "Yanlış / İtiraz Edildi",
};

export const categoryLabels: Record<string, string> = {
  earthquake: "Deprem",
  flood: "Sel",
  fire: "Yangın",
  infrastructure: "Altyapı",
  explosion: "Patlama",
  road: "Yol",
  health: "Sağlık",
  other: "Diğer",
};
