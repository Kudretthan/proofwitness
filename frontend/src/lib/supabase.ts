import { createClient } from "@supabase/supabase-js";
import type { Claim, Verification, CreditLedger } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database record types mapping to Frontend types
export interface DBClaim {
  id: string;
  title: string;
  description: string;
  location: string;
  incident_date: string;
  incident_time: string;
  category: string;
  creator_wallet: string;
  ai: any;
  status: string;
  created_at: string;
  claim_hash: string;
  ai_report_hash: string;
  stake_amount: string;
  stake_tx_hash: string;
  reward_credits: number;
  rewards_distributed: boolean;
  payout_tx_hash: string | null;
  soroban_synced: boolean | null;
  soroban_tx_hash: string | null;
}

export interface DBVerification {
  id: string;
  claim_id: string;
  verifier_wallet: string;
  decision: string;
  note: string;
  evidence_url: string | null;
  created_at: string;
  verification_hash: string;
  stake_amount: string;
  stake_tx_hash: string;
  reward_credits: number;
}

export interface DBCreditLedger {
  wallet: string;
  credits: number;
}

export async function fetchAllData() {
  if (!supabase) return null;
  
  try {
    const [claimsRes, verificationsRes, ledgerRes] = await Promise.all([
      supabase.from("claims").select("*").order("created_at", { ascending: false }),
      supabase.from("verifications").select("*").order("created_at", { ascending: true }),
      supabase.from("credit_ledger").select("*")
    ]);

    if (claimsRes.error) throw claimsRes.error;
    if (verificationsRes.error) throw verificationsRes.error;
    if (ledgerRes.error) throw ledgerRes.error;

    const dbClaims = claimsRes.data as DBClaim[];
    const dbVerifs = verificationsRes.data as DBVerification[];
    const dbLedger = ledgerRes.data as DBCreditLedger[];

    // Map DB ledger to frontend Record<string, number>
    const creditLedger: CreditLedger = {};
    for (const row of dbLedger) {
      creditLedger[row.wallet] = row.credits;
    }

    // Map DB claims and verifications to frontend Claim[]
    const claims: Claim[] = dbClaims.map((dbc) => {
      const claimVerifs = dbVerifs
        .filter((v) => v.claim_id === dbc.id)
        .map((v) => ({
          id: v.id,
          claimId: v.claim_id,
          verifierWallet: v.verifier_wallet,
          decision: v.decision as "true" | "false" | "unsure",
          note: v.note,
          evidenceUrl: v.evidence_url || undefined,
          createdAt: v.created_at,
          verificationHash: v.verification_hash,
          stakeAmount: v.stake_amount,
          stakeTxHash: v.stake_tx_hash,
          rewardCredits: v.reward_credits,
        }));

      return {
        id: dbc.id,
        title: dbc.title,
        description: dbc.description,
        location: dbc.location,
        incidentDate: dbc.incident_date,
        incidentTime: dbc.incident_time,
        category: dbc.category,
        creatorWallet: dbc.creator_wallet,
        ai: dbc.ai,
        status: dbc.status as any,
        createdAt: dbc.created_at,
        claimHash: dbc.claim_hash,
        aiReportHash: dbc.ai_report_hash,
        stakeAmount: dbc.stake_amount,
        stakeTxHash: dbc.stake_tx_hash,
        rewardCredits: dbc.reward_credits,
        rewardsDistributed: dbc.rewards_distributed,
        verifications: claimVerifs,
        escrowPayoutDone: !!dbc.payout_tx_hash,
      };
    });

    return { claims, creditLedger };
  } catch (error) {
    console.error("Supabase fetchAllData error:", error);
    alert("Supabase'den veriler çekilirken hata oluştu. LocalStorage ile devam ediliyor.");
    return null;
  }
}

export async function insertClaim(claim: Claim) {
  if (!supabase) return;
  try {
    const dbClaim: DBClaim = {
      id: claim.id,
      title: claim.title,
      description: claim.description,
      location: claim.location,
      incident_date: claim.incidentDate,
      incident_time: claim.incidentTime,
      category: claim.category,
      creator_wallet: claim.creatorWallet,
      ai: claim.ai,
      status: claim.status,
      created_at: claim.createdAt,
      claim_hash: claim.claimHash || "",
      ai_report_hash: claim.aiReportHash || "",
      stake_amount: claim.stakeAmount,
      stake_tx_hash: claim.stakeTxHash || "",
      reward_credits: claim.rewardCredits || 0,
      rewards_distributed: !!claim.rewardsDistributed,
      payout_tx_hash: claim.escrowPayoutDone ? "done" : null, // Fallback since frontend uses a boolean
      soroban_synced: false,
      soroban_tx_hash: null,
    };
    const { error } = await supabase.from("claims").insert(dbClaim);
    if (error) throw error;
  } catch (error) {
    console.error("Supabase insertClaim error:", error);
    alert("Supabase'e bildirim kaydedilirken hata oluştu. LocalStorage'a kaydedildi.");
  }
}

export async function insertVerification(claimId: string, verification: Verification) {
  if (!supabase) return;
  try {
    // We generate a dummy ID or use verificationHash as id
    const dbVerif: DBVerification = {
      id: verification.verificationHash || crypto.randomUUID(),
      claim_id: claimId,
      verifier_wallet: verification.verifierWallet,
      decision: verification.decision,
      note: verification.note,
      evidence_url: verification.evidenceUrl || null,
      created_at: verification.createdAt,
      verification_hash: verification.verificationHash || "",
      stake_amount: verification.stakeAmount,
      stake_tx_hash: verification.stakeTxHash || "",
      reward_credits: verification.rewardCredits || 0,
    };
    const { error } = await supabase.from("verifications").insert(dbVerif);
    if (error) throw error;
  } catch (error) {
    console.error("Supabase insertVerification error:", error);
    alert("Supabase'e doğrulama kaydedilirken hata oluştu. LocalStorage'a kaydedildi.");
  }
}

export async function updateClaimStatus(claim: Claim) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("claims")
      .update({
        status: claim.status,
        reward_credits: claim.rewardCredits || 0,
        rewards_distributed: claim.rewardsDistributed || false,
        payout_tx_hash: claim.escrowPayoutDone ? "done" : null
      })
      .eq("id", claim.id);
    if (error) throw error;
  } catch (error) {
    console.error("Supabase updateClaimStatus error:", error);
    alert("Supabase'de bildirim durumu güncellenirken hata oluştu.");
  }
}

export async function updateCreditLedger(ledger: CreditLedger) {
  if (!supabase) return;
  try {
    const rows = Object.entries(ledger).map(([wallet, credits]) => ({
      wallet,
      credits
    }));
    if (rows.length === 0) return;
    
    // Upsert the whole ledger
    const { error } = await supabase.from("credit_ledger").upsert(rows);
    if (error) throw error;
  } catch (error) {
    console.error("Supabase updateCreditLedger error:", error);
    alert("Supabase'de kredi kayıtları güncellenirken hata oluştu.");
  }
}
