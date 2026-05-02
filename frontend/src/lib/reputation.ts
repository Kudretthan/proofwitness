import type { CreditLedger } from "../types";

export type BadgeInfo = {
  label: string;
  color: string;
  bg: string;
};

const BADGES: { min: number; badge: BadgeInfo }[] = [
  {
    min: 100,
    badge: {
      label: "Topluluk Doğrulayıcısı",
      color: "text-violet-200",
      bg: "bg-violet-500/15 border-violet-400/30",
    },
  },
  {
    min: 50,
    badge: {
      label: "Öncelikli Doğrulayıcı",
      color: "text-cyan-200",
      bg: "bg-cyan-500/15 border-cyan-400/30",
    },
  },
  {
    min: 20,
    badge: {
      label: "Güvenilir Tanık",
      color: "text-emerald-200",
      bg: "bg-emerald-500/15 border-emerald-400/30",
    },
  },
  {
    min: 0,
    badge: {
      label: "Yeni Tanık",
      color: "text-slate-300",
      bg: "bg-slate-500/15 border-slate-400/20",
    },
  },
];

const ANON_BADGE: BadgeInfo = {
  label: "Anonim",
  color: "text-slate-400",
  bg: "bg-slate-500/10 border-slate-400/20",
};

export function getBadge(walletAddress: string, creditLedger: CreditLedger): BadgeInfo {
  if (!walletAddress || walletAddress === "not-connected") {
    return ANON_BADGE;
  }

  const credits = creditLedger[walletAddress] || 0;
  return getBadgeByCredits(credits);
}

export function getBadgeByCredits(credits: number): BadgeInfo {
  for (const entry of BADGES) {
    if (credits >= entry.min) return entry.badge;
  }

  return BADGES[BADGES.length - 1].badge;
}

export function isAnonymous(walletAddress: string): boolean {
  return !walletAddress || walletAddress === "not-connected";
}
