import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  getNetwork as freighterGetNetwork,
  requestAccess as freighterRequestAccess,
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
 * Extract Stellar address from various Freighter API response formats.
 * Handles:
 * - Direct string: "G..."
 * - { address: "G..." }
 * - { publicKey: "G..." }
 * - { result: { address: "G..." } }
 * - { result: { publicKey: "G..." } }
 * - Error objects
 */
function extractFreighterAddress(response: unknown): string | null {
  if (!response) return null;

  // Direct string response
  if (typeof response === "string") {
    if (response.startsWith("G") && response.length === 56) {
      return response;
    }
    return null;
  }

  // Object response
  if (typeof response === "object" && response !== null) {
    const obj = response as Record<string, any>;

    // Direct address property
    if (obj.address && typeof obj.address === "string") {
      if (obj.address.startsWith("G") && obj.address.length === 56) {
        return obj.address;
      }
    }

    // Direct publicKey property
    if (obj.publicKey && typeof obj.publicKey === "string") {
      if (obj.publicKey.startsWith("G") && obj.publicKey.length === 56) {
        return obj.publicKey;
      }
    }

    // Nested result.address
    if (obj.result && typeof obj.result === "object") {
      const result = obj.result as Record<string, any>;
      if (result.address && typeof result.address === "string") {
        if (result.address.startsWith("G") && result.address.length === 56) {
          return result.address;
        }
      }
      if (result.publicKey && typeof result.publicKey === "string") {
        if (result.publicKey.startsWith("G") && result.publicKey.length === 56) {
          return result.publicKey;
        }
      }
    }
  }

  return null;
}

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

  return "Freighter adresi alınamadı. Lütfen Freighter'ı açın, site izni verin ve tekrar deneyin.";
}

/**
 * Check if Freighter extension is installed and accessible.
 */
export async function checkInstalled(): Promise<{ installed: boolean; error?: string }> {
  try {
    const result = await freighterIsConnected();
    console.debug("Freighter isConnected result:", result);
    
    // Handle various response formats
    if (typeof result === "boolean") {
      return { installed: result };
    }
    
    if (typeof result === "object" && result !== null) {
      const obj = result as any;
      if (obj.isConnected === true || obj.isConnected === false) {
        return { installed: true };
      }
      if (obj.installed === true || obj.installed === false) {
        return { installed: true };
      }
    }
    
    return { installed: Boolean(result) };
  } catch (error) {
    console.error("Freighter installation check failed:", error);
    const errorMsg = String(error);
    
    if (errorMsg.includes("locked")) {
      return { installed: true, error: "locked" };
    }
    
    return { installed: false, error: "not_installed" };
  }
}

/**
 * Connect wallet and return wallet state with detailed error handling.
 * Uses requestAccess() to ensure proper permission flow.
 * Returns WalletState with connected: true and publicKey set on success.
 */
export async function connectWallet(): Promise<WalletState> {
  // Step 1: Check if Freighter is installed
  const installCheck = await checkInstalled();
  if (!installCheck.installed) {
    console.error("Freighter connection failed: not installed");
    return {
      ...EMPTY_STATE,
      installed: false,
      error: "not_installed",
    };
  }

  // Step 2: Request access from user (main permission flow)
  let publicKey = "";
  try {
    const accessResponse = await freighterRequestAccess();
    console.log("Freighter requestAccess response:", accessResponse);
    publicKey = extractFreighterAddress(accessResponse) || "";
  } catch (error) {
    console.error("Freighter requestAccess failed:", error);
    
    const errorStr = String(error);
    let errorType: WalletError = "unknown_error";
    
    if (errorStr.includes("locked") || errorStr.includes("timeout")) {
      errorType = "locked";
    } else if (errorStr.includes("permission") || errorStr.includes("user rejected") || errorStr.includes("denied")) {
      errorType = "permission_denied";
    } else if (errorStr.includes("network")) {
      errorType = "network_error";
    }
    
    return {
      installed: true,
      connected: false,
      publicKey: "",
      network: "",
      error: errorType,
    };
  }

  // Step 3: Fallback to getAddress if requestAccess didn't return address
  if (!publicKey) {
    try {
      const addressResponse = await freighterGetAddress();
      console.log("Freighter getAddress response:", addressResponse);
      publicKey = extractFreighterAddress(addressResponse) || "";
    } catch (error) {
      console.error("Freighter getAddress fallback failed:", error);
    }
  }

  // Step 4: Check if we got address after both attempts
  if (!publicKey) {
    console.error("Freighter connection failed: no address found");
    return {
      installed: true,
      connected: false,
      publicKey: "",
      network: "",
      error: "unknown_error",
    };
  }

  // Step 5: Get network info (best effort, don't fail if this fails)
  let network = "unknown";
  try {
    const networkResponse = await freighterGetNetwork();
    console.log("Freighter network response:", networkResponse);
    
    if (typeof networkResponse === "string") {
      network = networkResponse;
    } else if (networkResponse && typeof networkResponse === "object") {
      const obj = networkResponse as any;
      if (obj.network) {
        network = obj.network;
      } else if (obj.networkPassphrase) {
        network = obj.networkPassphrase;
      } else if (obj.result && obj.result.network) {
        network = obj.result.network;
      }
    }
  } catch (error) {
    console.warn("Could not determine network:", error);
    // Continue anyway - network detection is best effort
  }

  // Step 6: Return success with publicKey
  return {
    installed: true,
    connected: true,
    publicKey,
    network,
  };
}

/**
 * Shorten a Stellar public key for display: GA2I...JQSZ
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address || "not-connected";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getHorizonUrl(network: string): string {
  const normalized = network.toLowerCase();
  if (normalized === "public" || normalized.includes("public global stellar network")) {
    return "https://horizon.stellar.org";
  }
  return "https://horizon-testnet.stellar.org";
}

export async function getXlmBalance(publicKey: string, network = "TESTNET"): Promise<string> {
  if (!publicKey) return "0.00";

  const response = await fetch(`${getHorizonUrl(network)}/accounts/${publicKey}`);
  if (response.status === 404) return "0.00";
  if (!response.ok) {
    throw new Error(`Horizon balance request failed: ${response.status}`);
  }

  const data = await response.json();
  const nativeBalance = data?.balances?.find((balance: { asset_type?: string }) => {
    return balance.asset_type === "native";
  });

  const amount = Number.parseFloat(nativeBalance?.balance || "0");
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

/**
 * Try to auto-reconnect Freighter silently (no requestAccess popup).
 * Only uses silent getAddress and isConnected checks.
 * Does NOT call requestAccess() - that's only for explicit user button clicks.
 * Returns connected state if permission was previously granted,
 * otherwise returns disconnected state without bothering the user.
 */
export async function tryAutoConnect(): Promise<WalletState> {
  // Step 1: Check if Freighter is installed
  const installCheck = await checkInstalled();
  if (!installCheck.installed) {
    return EMPTY_STATE;
  }

  // Step 2: Try getting address silently (no popup if permission was already granted)
  let publicKey = "";
  try {
    const addressResponse = await freighterGetAddress();
    console.debug("Auto-connect getAddress response:", addressResponse);
    publicKey = extractFreighterAddress(addressResponse) || "";
  } catch (error) {
    console.debug("Auto-connect getAddress failed (expected if no prior permission):", error);
    return {
      installed: true,
      connected: false,
      publicKey: "",
      network: "",
    };
  }

  // Step 3: Check if we got address
  if (!publicKey) {
    console.debug("Auto-connect: no publicKey found");
    return {
      installed: true,
      connected: false,
      publicKey: "",
      network: "",
    };
  }

  // Step 4: Get network info (best effort)
  let network = "unknown";
  try {
    const networkResponse = await freighterGetNetwork();
    console.debug("Auto-connect getNetwork response:", networkResponse);
    
    if (typeof networkResponse === "string") {
      network = networkResponse;
    } else if (networkResponse && typeof networkResponse === "object") {
      const obj = networkResponse as any;
      if (obj.network) {
        network = obj.network;
      } else if (obj.networkPassphrase) {
        network = obj.networkPassphrase;
      } else if (obj.result && obj.result.network) {
        network = obj.result.network;
      }
    }
  } catch (error) {
    console.debug("Auto-connect: could not determine network:", error);
    // Continue anyway - network detection is best effort
  }

  // Step 5: Return success with publicKey
  return {
    installed: true,
    connected: true,
    publicKey,
    network,
  };
}
