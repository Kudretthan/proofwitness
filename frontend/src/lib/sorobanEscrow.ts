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
const READ_ONLY_SOURCE_ACCOUNT =
  import.meta.env.VITE_SOROBAN_READ_ONLY_SOURCE_ACCOUNT ||
  "GBQRMRIH4UCY3YKHCJAHJZII4SFQ66XBBHKKQ7PV6Z6UKJN4F7VOV2C7";

// ─── Stake Mode ───

export type StakeMode = "treasury" | "soroban";

export function getStakeMode(): StakeMode {
  const mode = (import.meta.env.VITE_STAKE_MODE || "").trim().toLowerCase();
  if (mode === "soroban") return "soroban";
  return "treasury"; // Varsayılan: treasury
}

/**
 * Returns error message if VITE_STAKE_MODE is set but invalid.
 * Returns null if value is acceptable.
 */
export function getStakeModeConfigError(): string | null {
  const raw = (import.meta.env.VITE_STAKE_MODE || "").trim();
  if (raw === "soroban" || raw === "treasury") return null;
  return `VITE_STAKE_MODE hatalı veya eksik: "${raw}" bulundu. Sadece "soroban" veya "treasury" olmalıdır.`;
}

export function isSorobanReady(): boolean {
  // Hem contract ID'leri hem de RPC URL'yi kontrol et
  return !!ESCROW_CONTRACT_ID && !!XLM_TOKEN_ID && !!SOROBAN_RPC_URL;
}

export function getSorobanConfigError(): string | null {
  if (!ESCROW_CONTRACT_ID) {
    return "VITE_SOROBAN_ESCROW_CONTRACT_ID tanımlı değil. Soroban escrow modunu kullanmak için contract deploy edip ID'yi .env dosyasına ekleyin.";
  }
  if (!XLM_TOKEN_ID) {
    return "VITE_XLM_TOKEN_CONTRACT_ID tanımlı değil. Testnet native XLM contract ID'sini .env dosyasına ekleyin.";
  }
  if (!SOROBAN_RPC_URL) {
    return "VITE_STELLAR_RPC_URL tanımlı değil.";
  }
  return null;
}

// ─── Soroban RPC Client ───

/**
 * Check if the contract is already initialized by calling a read-only function.
 * We call contract_balance which requires init. If it panics, contract is not initialized.
 */
export async function checkContractInitialized(): Promise<boolean> {
  if (!ESCROW_CONTRACT_ID || !XLM_TOKEN_ID) return false;
  const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  const contract = new StellarSdk.Contract(ESCROW_CONTRACT_ID);

  // Use a valid account-shaped source for simulation only; no transaction is submitted.
  try {
    const readOnlyAccount = new StellarSdk.Account(READ_ONLY_SOURCE_ACCOUNT, "0");

    const tx = new StellarSdk.TransactionBuilder(readOnlyAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("contract_balance"))
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize the escrow contract. Must be called by the admin wallet once after deploy.
 */
export async function sorobanInitContract(
  adminPublicKey: string
): Promise<{ success: boolean; txHash: string; error?: string }> {
  try {
    const cId = ESCROW_CONTRACT_ID;
    if (!cId) throw new Error("VITE_SOROBAN_ESCROW_CONTRACT_ID tanımlı değil.");
    if (!XLM_TOKEN_ID) throw new Error("VITE_XLM_TOKEN_CONTRACT_ID tanımlı değil.");

    const args: StellarSdk.xdr.ScVal[] = [
      new StellarSdk.Address(adminPublicKey).toScVal(),
      new StellarSdk.Address(XLM_TOKEN_ID).toScVal(),
    ];

    const response = await invokeContract(adminPublicKey, cId, "init", args);
    return {
      success: response.status === "SUCCESS",
      txHash:
        response.status === "SUCCESS"
          ? (response as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse).txHash || ""
          : "",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sorobanInitContract failed:", err);
    if (isAlreadyInitializedInitError(msg)) {
      return { success: false, txHash: "", error: "Contract zaten initialize edilmiş." };
    }
    return { success: false, txHash: "", error: msg };
  }
}

function isAlreadyInitializedInitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("init") &&
    lower.includes("invalidaction") &&
    lower.includes("unreachablecodereached")
  );
}



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
