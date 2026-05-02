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
 * Uses requestAccess() to ensure proper permission flow.
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

    // 2. Request access from user (mandatory permission flow)
    let publicKey = "";
    let accessError: WalletError | null = null;

    try {
      console.log("Calling Freighter requestAccess()...");
      const accessResponse = await freighterRequestAccess();
      console.log("Freighter requestAccess response:", accessResponse);

      // Extract address from various response formats
      publicKey = extractFreighterAddress(accessResponse) || "";

      if (!publicKey) {
        console.log("No address from requestAccess, trying fallback getAddress()...");
        try {
          const fallbackResponse = await freighterGetAddress();
          console.log("Freighter getAddress response:", fallbackResponse);
          publicKey = extractFreighterAddress(fallbackResponse) || "";
        } catch (fallbackErr) {
          console.error("Fallback getAddress also failed:", fallbackErr);
        }
      }
    } catch (err) {
      console.error("Freighter requestAccess failed:", err);
      const errorStr = String(err);

      if (errorStr.includes("locked") || errorStr.includes("timeout")) {
        accessError = "locked";
      } else if (
        errorStr.includes("permission") ||
        errorStr.includes("user rejected") ||
        errorStr.includes("User has") ||
        errorStr.includes("denied")
      ) {
        accessError = "permission_denied";
      } else if (errorStr.includes("network")) {
        accessError = "network_error";
      } else {
        accessError = "unknown_error";
      }
    }

    if (accessError) {
      return {
        installed: true,
        connected: false,
        publicKey: "",
        network: "",
        error: accessError,
      };
    }

    if (!publicKey) {
      console.error(
        "Freighter adresi alınamadı. requestAccess ve fallback getAddress başarısız."
      );
      return {
        installed: true,
        connected: false,
        publicKey: "",
        network: "",
        error: "unknown_error",
      };
    }

    // 3. Get network (best effort, don't fail if error)
    let network = "unknown";
    try {
      const netResult = await freighterGetNetwork();
      console.log("Freighter network result:", netResult);
      
      if (typeof netResult === "object" && netResult !== null && "network" in netResult) {
        network = (netResult as { network: string }).network || "unknown";
      } else if (typeof netResult === "string") {
        network = netResult || "unknown";
      }
    } catch (err) {
      console.warn("Could not determine network (continuing anyway):", err);
      // Continue even if network detection fails
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
 * Try to auto-reconnect Freighter silently (no requestAccess popup).
 * Only uses silent getAddress and isConnected checks.
 * Does NOT call requestAccess() - that's only for explicit user button clicks.
 * Returns connected state if permission was previously granted,
 * otherwise returns disconnected state without bothering the user.
 */
export async function tryAutoConnect(): Promise<WalletState> {
  try {
    const installCheck = await checkInstalled();
    if (!installCheck.installed) {
      return EMPTY_STATE;
    }

    // Try getting address silently — if permission was granted before,
    // this returns the key without a popup
    let publicKey = "";
    try {
      const addrResult = await freighterGetAddress();
      console.debug("Auto-connect getAddress response:", addrResult);
      publicKey = extractFreighterAddress(addrResult) || "";
    } catch (err) {
      // Permission not granted or user needs to reconnect
      console.debug("Auto-connect getAddress failed (expected if no prior permission):", err);
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    if (!publicKey) {
      console.debug("Auto-connect: no publicKey found");
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    let network = "unknown";
    try {
      const netResult = await freighterGetNetwork();
      console.debug("Auto-connect getNetwork response:", netResult);
      
      if (typeof netResult === "object" && netResult !== null && "network" in netResult) {
        network = (netResult as { network: string }).network || "unknown";
      } else if (typeof netResult === "string") {
        network = netResult || "unknown";
      }
    } catch (err) {
      console.debug("Could not determine network during auto-connect (continuing):", err);
      // Don't fail if network detection fails
    }

    return { installed: true, connected: true, publicKey, network };
  } catch (err) {
    console.debug("Auto-connect error:", err);
    return EMPTY_STATE;
  }
}
