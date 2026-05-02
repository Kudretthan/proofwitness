/**
 * Soroban Escrow Integration for ProofWitness
 *
 * Soroban contract çağrıları Freighter ile imzalanarak yapılır.
 * Bu modül yalnızca VITE_STAKE_MODE=soroban olduğunda kullanılır.
 *
 * Tüm işlemler Stellar Testnet üzerindedir. Private key kullanılmaz.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

// ─── Config ───

const SOROBAN_RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const ESCROW_CONTRACT_ID = import.meta.env.VITE_SOROBAN_ESCROW_CONTRACT_ID || "";
const XLM_TOKEN_ID = import.meta.env.VITE_XLM_TOKEN_CONTRACT_ID || "";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

// ─── Stake Mode ───

export type StakeMode = "treasury" | "soroban";

export function getStakeMode(): StakeMode {
  const mode = import.meta.env.VITE_STAKE_MODE || "treasury";
  return mode === "soroban" ? "soroban" : "treasury";
}

export function isSorobanReady(): boolean {
  return !!ESCROW_CONTRACT_ID && !!XLM_TOKEN_ID;
}

export function getSorobanConfigError(): string | null {
  if (!ESCROW_CONTRACT_ID) {
    return "VITE_SOROBAN_ESCROW_CONTRACT_ID tanımlı değil. Soroban escrow modunu kullanmak için contract deploy edip ID'yi .env dosyasına ekleyin.";
  }
  if (!XLM_TOKEN_ID) {
    return "VITE_XLM_TOKEN_CONTRACT_ID tanımlı değil. Testnet native XLM contract ID'sini .env dosyasına ekleyin.";
  }
  return null;
}

// ─── Soroban RPC Client ───

function getRpcServer(): StellarSdk.rpc.Server {
  return new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
}

// ─── Helpers ───

function contractAddress(): string {
  if (!ESCROW_CONTRACT_ID) throw new Error("Soroban escrow contract ID tanımlı değil.");
  return ESCROW_CONTRACT_ID;
}

/**
 * Soroban contract invoke transaction'ı oluştur, simüle et, Freighter ile imzalat, gönder.
 */
async function invokeContract(
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  const server = getRpcServer();

  // Source account yükle
  const sourceAccount = await server.getAccount(sourcePublicKey);

  // Contract oluştur
  const contract = new StellarSdk.Contract(contractId);

  // Transaction build
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  // Simulate
  const simulated = await server.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    const errMsg =
      (simulated as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error ||
      "Soroban simulasyon hatası";
    throw new Error(`Simulasyon hatası: ${errMsg}`);
  }

  // Assemble the transaction with simulation results
  const assembled = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  const xdr = assembled.toXDR();

  // Freighter ile imzalat
  let signedXdr: string;
  try {
    const signResult = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (typeof signResult === "string") {
      signedXdr = signResult;
    } else if (typeof signResult === "object" && signResult !== null) {
      const r = signResult as Record<string, unknown>;
      signedXdr =
        (r.signedTxXdr as string) ||
        (r.signedXDR as string) ||
        (r.signedTx as string) ||
        (r.result as string) ||
        "";
    } else {
      signedXdr = "";
    }

    if (!signedXdr) {
      throw new Error("İmzalı transaction verisi alınamadı.");
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      const lower = err.message.toLowerCase();
      if (
        lower.includes("user declined") ||
        lower.includes("cancel") ||
        lower.includes("rejected") ||
        lower.includes("denied")
      ) {
        throw new Error("İşlem kullanıcı tarafından reddedildi.", { cause: err });
      }
      throw new Error(`Freighter imzalama hatası: ${err.message}`, { cause: err });
    }
    throw new Error("İşlem kullanıcı tarafından reddedildi.", { cause: err });
  }

  // Parse & submit
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE
  ) as StellarSdk.Transaction;

  const sendResponse = await server.sendTransaction(signedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error("Transaction gönderilemedi: " + JSON.stringify(sendResponse));
  }

  // Poll for result
  let getResponse: StellarSdk.rpc.Api.GetTransactionResponse;
  let attempts = 0;
  do {
    await new Promise((r) => setTimeout(r, 2000));
    getResponse = await server.getTransaction(sendResponse.hash);
    attempts++;
  } while (getResponse.status === "NOT_FOUND" && attempts < 30);

  if (getResponse.status === "NOT_FOUND") {
    throw new Error("Transaction sonucu alınamadı. Zaman aşımı.");
  }

  if (getResponse.status === "FAILED") {
    throw new Error("Transaction başarısız oldu.");
  }

  return getResponse;
}

// ─── Contract Calls ───

export type SorobanStakeResult = {
  success: boolean;
  txHash: string;
};

/**
 * Soroban escrow contract üzerinden claim oluştur ve stake kilitle.
 */
export async function sorobanCreateClaimWithStake(
  creatorPublicKey: string,
  claimId: string,
  claimHash: string,
  aiReportHash: string
): Promise<SorobanStakeResult> {
  const cId = contractAddress();
  const createdAt = Math.floor(Date.now() / 1000);

  const args: StellarSdk.xdr.ScVal[] = [
    new StellarSdk.Address(creatorPublicKey).toScVal(),
    StellarSdk.nativeToScVal(claimId, { type: "string" }),
    StellarSdk.nativeToScVal(claimHash, { type: "string" }),
    StellarSdk.nativeToScVal(aiReportHash, { type: "string" }),
    StellarSdk.nativeToScVal(createdAt, { type: "u64" }),
  ];

  const response = await invokeContract(
    creatorPublicKey,
    cId,
    "create_claim_with_stake",
    args
  );

  return {
    success: response.status === "SUCCESS",
    txHash: response.status === "SUCCESS"
      ? (response as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse).txHash || ""
      : "",
  };
}

/**
 * Soroban escrow contract üzerinden verification ekle ve stake kilitle.
 */
export async function sorobanAddVerificationWithStake(
  verifierPublicKey: string,
  claimId: string,
  verificationId: string,
  decision: string,
  verificationHash: string,
  evidenceHash: string
): Promise<SorobanStakeResult> {
  const cId = contractAddress();
  const createdAt = Math.floor(Date.now() / 1000);

  const args: StellarSdk.xdr.ScVal[] = [
    new StellarSdk.Address(verifierPublicKey).toScVal(),
    StellarSdk.nativeToScVal(claimId, { type: "string" }),
    StellarSdk.nativeToScVal(verificationId, { type: "string" }),
    StellarSdk.nativeToScVal(decision, { type: "symbol" }),
    StellarSdk.nativeToScVal(verificationHash, { type: "string" }),
    StellarSdk.nativeToScVal(evidenceHash, { type: "string" }),
    StellarSdk.nativeToScVal(createdAt, { type: "u64" }),
  ];

  const response = await invokeContract(
    verifierPublicKey,
    cId,
    "add_verification_with_stake",
    args
  );

  return {
    success: response.status === "SUCCESS",
    txHash: response.status === "SUCCESS"
      ? (response as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse).txHash || ""
      : "",
  };
}

/**
 * Soroban escrow contract üzerinden resolve ve payout çalıştır.
 */
export async function sorobanResolveAndPayout(
  callerPublicKey: string,
  claimId: string
): Promise<SorobanStakeResult> {
  const cId = contractAddress();

  const args: StellarSdk.xdr.ScVal[] = [
    StellarSdk.nativeToScVal(claimId, { type: "string" }),
  ];

  const response = await invokeContract(
    callerPublicKey,
    cId,
    "resolve_and_payout",
    args
  );

  return {
    success: response.status === "SUCCESS",
    txHash: response.status === "SUCCESS"
      ? (response as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse).txHash || ""
      : "",
  };
}
