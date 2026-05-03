import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { getStakeMode, getSorobanConfigError } from "./lib/sorobanEscrow";
import { connectWallet, getXlmBalance, tryAutoConnect } from "./lib/wallet";
import type { WalletState, WalletError } from "./lib/wallet";
import type { Claim, ClaimStatus, CreditLedger, Verification } from "./types";
import {
  isSupabaseConfigured,
  fetchAllData,
  insertClaim,
  insertVerification,
  updateClaimStatus,
  updateCreditLedger,
} from "./lib/supabase";

import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import CreateClaimPage from "./pages/CreateClaimPage";
import ActiveClaimsPage from "./pages/ActiveClaimsPage";
import VerifiedClaimsPage from "./pages/VerifiedClaimsPage";
import DisputedClaimsPage from "./pages/DisputedClaimsPage";
import ReputationPage from "./pages/ReputationPage";
import SystemPage from "./pages/SystemPage";

const LS_CLAIMS = "proofwitness_claims";
const LS_CREDITS = "proofwitness_credit_ledger";

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage can be blocked or full in demo environments.
  }
}

function computeStatus(verifications: Verification[]): ClaimStatus {
  const trueCount = verifications.filter((v) => v.decision === "true").length;
  const falseCount = verifications.filter((v) => v.decision === "false").length;
  if (trueCount >= 3) return "Verified";
  if (falseCount >= 2) return "False / Disputed";
  return "Needs Evidence";
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    installed: false,
    connected: false,
    publicKey: "",
    network: "",
  });
  const [walletError, setWalletError] = useState<WalletError | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>(() => loadFromLS<Claim[]>(LS_CLAIMS, []));
  const [creditLedger, setCreditLedger] = useState<CreditLedger>(() =>
    loadFromLS<CreditLedger>(LS_CREDITS, {})
  );
  const [supabaseError, setSupabaseError] = useState(false);

  const walletConnected = wallet.connected;
  const walletAddress = walletConnected ? wallet.publicKey : "not-connected";
  const userCredits = creditLedger[walletAddress] || 0;
  const stakeMode = getStakeMode();
  const sorobanConfigErr = stakeMode === "soroban" ? getSorobanConfigError() : null;

  useEffect(() => {
    saveToLS(LS_CLAIMS, claims);
  }, [claims]);

  useEffect(() => {
    saveToLS(LS_CREDITS, creditLedger);
  }, [creditLedger]);

  useEffect(() => {
    tryAutoConnect().then((state) => {
      if (state.connected) setWallet(state);
    });

    if (isSupabaseConfigured) {
      fetchAllData().then((data) => {
        if (data) {
          setClaims(data.claims);
          setCreditLedger(data.creditLedger);
          setSupabaseError(false);
        } else {
          setSupabaseError(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!wallet.connected || !wallet.publicKey) {
      setXlmBalance(null);
      return;
    }

    setXlmBalance(null);
    getXlmBalance(wallet.publicKey, wallet.network)
      .then((balance) => {
        if (!cancelled) setXlmBalance(balance);
      })
      .catch((err) => {
        console.error("XLM Bakiye çekme hatası:", err);
        if (!cancelled) setXlmBalance("0.00");
      });

    return () => {
      cancelled = true;
    };
  }, [wallet.connected, wallet.publicKey, wallet.network]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      const state = await connectWallet();
      setWallet(state);
      if (state.error) {
        setWalletError(state.error as WalletError);
        console.error("Freighter connection failed:", state.error);
      } else if (state.connected) {
        setWalletError(null);
      }
    } catch (err) {
      console.error("Freighter connection failed:", err);
      setWalletError("unknown_error");
    } finally {
      setConnecting(false);
    }
  }, []);

  const distributeCredits = useCallback(
    (claim: Claim, newStatus: ClaimStatus): { updatedClaim: Claim; ledgerDelta: CreditLedger } => {
      const ledgerDelta: CreditLedger = {};
      let updatedVerifications = [...claim.verifications];
      let claimRewardCredits = 0;

      if (newStatus === "Verified") {
        updatedVerifications = updatedVerifications.map((verification) => {
          if (verification.decision === "true") {
            ledgerDelta[verification.verifierWallet] = (ledgerDelta[verification.verifierWallet] || 0) + 10;
            return { ...verification, rewardCredits: 10 };
          }
          return verification;
        });
        ledgerDelta[claim.creatorWallet] = (ledgerDelta[claim.creatorWallet] || 0) + 5;
        claimRewardCredits = 5;
      } else if (newStatus === "False / Disputed") {
        updatedVerifications = updatedVerifications.map((verification) => {
          if (verification.decision === "false") {
            ledgerDelta[verification.verifierWallet] = (ledgerDelta[verification.verifierWallet] || 0) + 10;
            return { ...verification, rewardCredits: 10 };
          }
          return verification;
        });
      }

      const updatedClaim: Claim = {
        ...claim,
        verifications: updatedVerifications,
        rewardCredits: claimRewardCredits,
        rewardsDistributed: true,
        status: newStatus,
      };

      return { updatedClaim, ledgerDelta };
    },
    []
  );

  const handleClaimCreated = useCallback((claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
    if (isSupabaseConfigured) {
      insertClaim(claim);
    }
  }, []);

  const handleVerificationAdded = useCallback(
    (claimId: string, verification: Verification) => {
      setClaims((prev) =>
        prev.map((claim) => {
          if (claim.id !== claimId) return claim;

          const alreadyVerified = claim.verifications.some(
            (existing) =>
              existing.verifierWallet.toLowerCase() === verification.verifierWallet.toLowerCase()
          );
          if (alreadyVerified) return claim;

          const updatedVerifications = [...claim.verifications, verification];
          const newStatus = computeStatus(updatedVerifications);
          const oldStatus = claim.status;

          if (
            oldStatus === "Needs Evidence" &&
            (newStatus === "Verified" || newStatus === "False / Disputed") &&
            !claim.rewardsDistributed
          ) {
            const tempClaim = { ...claim, verifications: updatedVerifications };
            const { updatedClaim, ledgerDelta } = distributeCredits(tempClaim, newStatus);

            setCreditLedger((prevLedger) => {
              const newLedger = { ...prevLedger };
              for (const [address, credits] of Object.entries(ledgerDelta)) {
                newLedger[address] = (newLedger[address] || 0) + credits;
              }
              if (isSupabaseConfigured) {
              updateCreditLedger(newLedger);
            }
            return newLedger;
          });

          if (isSupabaseConfigured) {
            insertVerification(claimId, verification).then(() => {
              updateClaimStatus(updatedClaim);
            });
          }

          return updatedClaim;
        }

        const returnedClaim = {
          ...claim,
          verifications: updatedVerifications,
          status: newStatus,
        };

        if (isSupabaseConfigured) {
          insertVerification(claimId, verification).then(() => {
            if (newStatus !== oldStatus) {
              updateClaimStatus(returnedClaim);
            }
          });
        }

        return returnedClaim;
      })
    );
    },
    [distributeCredits]
  );

  const handleClearData = useCallback(() => {
    const ok = window.confirm("Tüm yerel bildirimleri ve kredileri silmek istediğinize emin misiniz?");
    if (!ok) return;
    localStorage.removeItem(LS_CLAIMS);
    localStorage.removeItem(LS_CREDITS);
    setClaims([]);
    setCreditLedger({});
  }, []);

  const handlePayoutDone = useCallback((claimId: string, payoutTxHash: string) => {
    setClaims((prev) =>
      prev.map((claim) => {
        if (claim.id === claimId) {
          const updated = { ...claim, escrowPayoutDone: true, payoutTxHash };
          if (isSupabaseConfigured) {
            updateClaimStatus(updated);
          }
          return updated;
        }
        return claim;
      })
    );
  }, []);

  const activeClaims = claims.filter((c) => c.status === "Needs Evidence");
  const verifiedClaims = claims.filter((c) => c.status === "Verified");
  const disputedClaims = claims.filter((c) => c.status === "False / Disputed");

  const totalVerifications = claims.reduce((sum, claim) => sum + claim.verifications.length, 0);
  const totalStaked = claims.reduce((sum, claim) => {
    const claimStake = Number.parseFloat(claim.stakeAmount) || 0;
    const verificationStake = claim.verifications.reduce(
      (verificationSum, verification) => verificationSum + (Number.parseFloat(verification.stakeAmount) || 0),
      0
    );
    return sum + claimStake + verificationStake;
  }, 0);
  const distributedCredits = Object.values(creditLedger).reduce((sum, credits) => sum + credits, 0);

  const stats = {
    totalClaims: claims.length,
    needsEvidence: activeClaims.length,
    verified: verifiedClaims.length,
    disputed: disputedClaims.length,
    totalVerifications,
    totalStaked: totalStaked.toFixed(1),
    distributedCredits,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            activeCount={activeClaims.length}
            verifiedCount={verifiedClaims.length}
            disputedCount={disputedClaims.length}
            wallet={wallet}
            walletError={walletError}
            connecting={connecting}
            userCredits={userCredits}
            xlmBalance={xlmBalance}
            onConnect={handleConnect}
            onClearData={handleClearData}
          />
        }
      >
        <Route
          index
          element={
            <DashboardPage
              stats={stats}
              walletConnected={walletConnected}
              stakeMode={stakeMode}
              sorobanConfigErr={sorobanConfigErr}
              xlmBalance={xlmBalance}
              recentClaims={claims.slice(0, 5)}
            />
          }
        />
        <Route
          path="create"
          element={
            <CreateClaimPage
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              onClaimCreated={handleClaimCreated}
            />
          }
        />
        <Route
          path="active"
          element={
            <ActiveClaimsPage
              claims={activeClaims}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={handleVerificationAdded}
              onPayoutDone={handlePayoutDone}
            />
          }
        />
        <Route
          path="verified"
          element={
            <VerifiedClaimsPage
              claims={verifiedClaims}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={handleVerificationAdded}
              onPayoutDone={handlePayoutDone}
            />
          }
        />
        <Route
          path="disputed"
          element={
            <DisputedClaimsPage
              claims={disputedClaims}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              creditLedger={creditLedger}
              onVerificationAdded={handleVerificationAdded}
              onPayoutDone={handlePayoutDone}
            />
          }
        />
        <Route
          path="reputation"
          element={
            <ReputationPage
              creditLedger={creditLedger}
              walletAddress={walletAddress}
            />
          }
        />
        <Route
          path="system"
          element={
            <SystemPage
              stakeMode={stakeMode}
              sorobanConfigErr={sorobanConfigErr}
              onClearData={handleClearData}
              supabaseError={supabaseError}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
            />
          }
        />
      </Route>
    </Routes>
  );
}
