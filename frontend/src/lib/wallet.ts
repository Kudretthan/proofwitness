import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  getNetwork as freighterGetNetwork,
} from "@stellar/freighter-api";

export type WalletState = {
  installed: boolean;
  connected: boolean;
  publicKey: string;
  network: string;
  error?: string;
};

export type WalletError =
  | "not_installed"
  | "locked"
  | "permission_denied"
  | "network_error"
  | "unknown_error";

const EMPTY_STATE: WalletState = {
  installed: false,
  connected: false,
  publicKey: "",
  network: "",
};

/**
 * Get user-friendly error message for wallet errors.
 */
export function getWalletErrorMessage(error: WalletError | unknown): string {
  if (typeof error === "string") {
    if (error === "not_installed") {
      return "Freighter cüzdanı bulunamadı. Lütfen Chrome/Brave'ye freighter.app adresinden yükleyin.";
    }
    if (error === "locked") {
      return "Freighter cüzdanı kilitli olabilir. Lütfen Freighter'ı açın ve kilidi kaldırın.";
    }
    if (error === "permission_denied") {
      return "Site izni verilmedi. Freighter popup'ında proofwitness.vercel.app için izin verin.";
    }
    if (error === "network_error") {
      return "Ağ hatası. Freighter'ın Stellar Testnet'e bağlı olduğundan emin olun.";
    }
  }

  const errorStr = String(error);
  if (errorStr.includes("locked") || errorStr.includes("timeout")) {
    return "Freighter cüzdanı kilitli veya zaman aşımı. Cüzdanı açın ve sayfayı yenileyin.";
  }
  if (errorStr.includes("permission") || errorStr.includes("user rejected")) {
    return "Site izni verilmedi. Freighter popup'ında izin verin.";
  }
  if (errorStr.includes("network")) {
    return "Ağ bağlantısı hatası. Testnet seçildiğini kontrol edin.";
  }

  return "Freighter'a bağlanılamadı. Lütfen tekrar deneyin.";
}

/**
 * Check if Freighter extension is installed and accessible.
 */
export async function checkInstalled(): Promise<{ installed: boolean; error?: string }> {
  try {
    const result = await freighterIsConnected();
    // freighter-api v2+ returns { isConnected: boolean }
    if (typeof result === "object" && result !== null && "isConnected" in result) {
      return { installed: true };
    }
    if (typeof result === "boolean") {
      return { installed: result };
    }
    return { installed: Boolean(result) };
  } catch (err) {
    console.error("Freighter installation check failed:", err);
    const errorMsg = String(err);
    if (errorMsg.includes("locked")) {
      return { installed: true, error: "locked" };
    }
    return { installed: false, error: "not_installed" };
  }
}

/**
 * Connect wallet and return wallet state with detailed error handling.
 */
export async function connectWallet(): Promise<WalletState> {
  try {
    // 1. Check installation
    const installCheck = await checkInstalled();
    if (!installCheck.installed) {
      console.error("Freighter connection failed: not installed");
      return {
        ...EMPTY_STATE,
        installed: false,
        error: "not_installed",
      };
    }

    // 2. Get address (triggers permission popup if needed)
    let publicKey = "";
    let addressError: WalletError | null = null;

    try {
      const addrResult = await freighterGetAddress();
      if (typeof addrResult === "object" && addrResult !== null) {
        if ("address" in addrResult) {
          publicKey = (addrResult as { address: string }).address;
        } else if ("publicKey" in addrResult) {
          publicKey = (addrResult as { publicKey: string }).publicKey;
        } else if ("error" in addrResult) {
          console.error("Freighter address error:", addrResult);
          addressError = "permission_denied";
        }
      } else if (typeof addrResult === "string") {
        publicKey = addrResult;
      }
    } catch (err) {
      console.error("Freighter address request failed:", err);
      const errorStr = String(err);
      
      if (errorStr.includes("locked") || errorStr.includes("timeout")) {
        addressError = "locked";
      } else if (
        errorStr.includes("permission") ||
        errorStr.includes("user rejected") ||
        errorStr.includes("User has") ||
        errorStr.includes("denied")
      ) {
        addressError = "permission_denied";
      } else if (errorStr.includes("network")) {
        addressError = "network_error";
      } else {
        addressError = "unknown_error";
      }
    }

    if (addressError) {
      return {
        installed: true,
        connected: false,
        publicKey: "",
        network: "",
        error: addressError,
      };
    }

    if (!publicKey) {
      console.error("Freighter address is empty");
      return {
        installed: true,
        connected: false,
        publicKey: "",
        network: "",
        error: "unknown_error",
      };
    }

    // 3. Get network (best effort, don't fail on error)
    let network = "unknown";
    try {
      const netResult = await freighterGetNetwork();
      if (typeof netResult === "object" && netResult !== null && "network" in netResult) {
        network = (netResult as { network: string }).network || "unknown";
      } else if (typeof netResult === "string") {
        network = netResult || "unknown";
      }
    } catch (err) {
      console.warn("Could not determine network:", err);
      // Continue anyway, network detection is optional
    }

    return {
      installed: true,
      connected: true,
      publicKey,
      network,
    };
  } catch (err) {
    console.error("Freighter connection failed:", err);
    return {
      ...EMPTY_STATE,
      error: "unknown_error",
    };
  }
}

/**
 * Shorten a Stellar public key for display: GA2I...JQSZ
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address || "not-connected";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Try to auto-reconnect Freighter silently (no popup).
 * Returns connected state if permission was previously granted,
 * otherwise returns disconnected state without bothering the user.
 */
export async function tryAutoConnect(): Promise<WalletState> {
  try {
    const installCheck = await checkInstalled();
    if (!installCheck.installed) {
      return EMPTY_STATE;
    }

    // Try getting address — if permission was granted before,
    // this returns the key without a popup
    let publicKey = "";
    try {
      const addrResult = await freighterGetAddress();
      if (typeof addrResult === "object" && addrResult !== null) {
        if ("address" in addrResult) {
          publicKey = (addrResult as { address: string }).address;
        } else if ("publicKey" in addrResult) {
          publicKey = (addrResult as { publicKey: string }).publicKey;
        }
      } else if (typeof addrResult === "string") {
        publicKey = addrResult;
      }
    } catch (err) {
      // Permission not granted or user needs to reconnect
      console.debug("Auto-connect failed (expected if no prior permission):", err);
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    if (!publicKey) {
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    let network = "unknown";
    try {
      const netResult = await freighterGetNetwork();
      if (typeof netResult === "object" && netResult !== null && "network" in netResult) {
        network = (netResult as { network: string }).network || "unknown";
      } else if (typeof netResult === "string") {
        network = netResult || "unknown";
      }
    } catch (err) {
      console.warn("Could not determine network during auto-connect:", err);
    }

    return { installed: true, connected: true, publicKey, network };
  } catch (err) {
    console.debug("Auto-connect error:", err);
    return EMPTY_STATE;
  }
}
