import type { CreditLedger } from "../types";

export type BadgeInfo = {
  label: string;
  color: string;
  bg: string;
};

const BADGES: { min: number; badge: BadgeInfo }[] = [
  { min: 100, badge: { label: "Topluluk Doğrulayıcısı", color: "text-violet-300", bg: "bg-violet-500/15 border-violet-500/30" } },
  { min: 50,  badge: { label: "Öncelikli Doğrulayıcı", color: "text-cyan-300", bg: "bg-cyan-500/15 border-cyan-500/30" } },
  { min: 20,  badge: { label: "Güvenilir Tanık", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" } },
  { min: 0,   badge: { label: "Yeni Tanık", color: "text-gray-400", bg: "bg-gray-500/15 border-gray-500/30" } },
];

const ANON_BADGE: BadgeInfo = {
  label: "Anonim",
  color: "text-gray-500",
  bg: "bg-gray-500/10 border-gray-500/20",
};

/**
 * Cüzdan adresine göre rozet belirle.
 */
export function getBadge(walletAddress: string, creditLedger: CreditLedger): BadgeInfo {
  if (!walletAddress || walletAddress === "not-connected") {
    return ANON_BADGE;
  }
  const credits = creditLedger[walletAddress] || 0;
  return getBadgeByCredits(credits);
}

/**
 * Kredi miktarına göre rozet belirle.
 */
export function getBadgeByCredits(credits: number): BadgeInfo {
  for (const entry of BADGES) {
    if (credits >= entry.min) return entry.badge;
  }
  return BADGES[BADGES.length - 1].badge;
}

/**
 * Cüzdan adresinin anonim olup olmadığını kontrol et.
 */
export function isAnonymous(walletAddress: string): boolean {
  return !walletAddress || walletAddress === "not-connected";
}
