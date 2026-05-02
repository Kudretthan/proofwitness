import * as StellarSdk from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

export type StakeResult = {
  hash: string;
  successful: boolean;
  ledger?: number;
};

export type StakeParams = {
  sourcePublicKey: string;
  destinationPublicKey: string;
  amount: string;
  memoText: string;
};

/**
 * Stellar Testnet üzerinde XLM payment transaction oluşturur,
 * Freighter ile imzalatır ve Horizon'a gönderir.
 */
export async function stakeXlmWithFreighter(
  params: StakeParams
): Promise<StakeResult> {
  const { sourcePublicKey, destinationPublicKey, amount, memoText } = params;

  const server = new StellarSdk.Horizon.Server(HORIZON_TESTNET);

  // 1. Source hesabı yükle
  let sourceAccount: StellarSdk.Horizon.AccountResponse;
  try {
    sourceAccount = await server.loadAccount(sourcePublicKey);
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.message.includes("404")
        ? "Hesabınız Testnet'te bulunamadı. Friendbot ile testnet XLM alın."
        : "Hesap yüklenemedi. Stellar Testnet ağını kontrol edin.";
    throw new Error(msg, { cause: err });
  }

  // 2. Transaction oluştur
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amount,
      })
    )
    .addMemo(StellarSdk.Memo.text(memoText))
    .setTimeout(180)
    .build();

  const xdr = transaction.toXDR();

  // 3. Freighter ile imzalat
  let signedXdr: string;
  try {
    const signResult = await signTransaction(xdr, {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    // Freighter API farklı formatlarda dönebilir
    if (typeof signResult === "string") {
      signedXdr = signResult;
    } else if (
      typeof signResult === "object" &&
      signResult !== null
    ) {
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

  // 4. Signed transaction'ı parse et
  let signedTx: StellarSdk.Transaction;
  try {
    signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction;
  } catch (err: unknown) {
    throw new Error("İmzalı transaction parse edilemedi.", { cause: err });
  }

  // 5. Horizon'a gönder
  try {
    const response = await server.submitTransaction(signedTx);
    return {
      hash: response.hash,
      successful: response.successful,
      ledger: response.ledger,
    };
  } catch (err: unknown) {
    // Horizon hata detaylarını çıkar
    if (
      err instanceof Error &&
      "response" in err &&
      typeof (err as Record<string, unknown>).response === "object"
    ) {
      const resp = (err as Record<string, unknown>).response as Record<string, unknown>;
      const data = resp.data as Record<string, unknown> | undefined;
      if (data?.extras) {
        const extras = data.extras as Record<string, unknown>;
        const codes = extras.result_codes as Record<string, unknown> | undefined;
        if (codes?.operations) {
          const opCodes = codes.operations as string[];
          if (opCodes.includes("op_underfunded")) {
            throw new Error(
              "Bakiye yetersiz. Friendbot ile testnet XLM alın: https://friendbot.stellar.org",
              { cause: err }
            );
          }
          if (opCodes.includes("op_no_destination")) {
            throw new Error(
              "Treasury hesabı Testnet'te bulunamadı. Treasury adresini kontrol edin.",
              { cause: err }
            );
          }
        }
      }
    }
    throw new Error(
      "Transaction gönderilemedi. Stellar Testnet ağını ve bakiyenizi kontrol edin.",
      { cause: err }
    );
  }
}

/**
 * Treasury adresini env'den al.
 */
export function getTreasuryAddress(): string {
  return import.meta.env.VITE_STAKE_TREASURY_ADDRESS || "";
}
