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
};

const EMPTY_STATE: WalletState = {
  installed: false,
  connected: false,
  publicKey: "",
  network: "",
};

/**
 * Check if Freighter extension is installed.
 */
export async function checkInstalled(): Promise<boolean> {
  try {
    const result = await freighterIsConnected();
    // freighter-api v2+ returns { isConnected: boolean }
    if (typeof result === "object" && result !== null && "isConnected" in result) {
      return true; // extension exists even if not connected
    }
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Connect wallet and return wallet state.
 */
export async function connectWallet(): Promise<WalletState> {
  try {
    // 1. Check installation
    const installed = await checkInstalled();
    if (!installed) {
      return { ...EMPTY_STATE, installed: false };
    }

    // 2. Get address (triggers permission popup if needed)
    let publicKey = "";
    try {
      const addrResult = await freighterGetAddress();
      if (typeof addrResult === "object" && addrResult !== null && "address" in addrResult) {
        publicKey = (addrResult as { address: string }).address;
      } else if (typeof addrResult === "string") {
        publicKey = addrResult;
      }
    } catch {
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    if (!publicKey) {
      return { installed: true, connected: false, publicKey: "", network: "" };
    }

    // 3. Get network (best effort)
    let network = "unknown";
    try {
      const netResult = await freighterGetNetwork();
      if (typeof netResult === "object" && netResult !== null && "network" in netResult) {
        network = (netResult as { network: string }).network || "unknown";
      } else if (typeof netResult === "string") {
        network = netResult || "unknown";
      }
    } catch {
      // network info is optional
    }

    return { installed: true, connected: true, publicKey, network };
  } catch {
    return EMPTY_STATE;
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
    const installed = await checkInstalled();
    if (!installed) return EMPTY_STATE;

    // Try getting address — if permission was granted before,
    // this returns the key without a popup
    let publicKey = "";
    try {
      const addrResult = await freighterGetAddress();
      if (typeof addrResult === "object" && addrResult !== null && "address" in addrResult) {
        publicKey = (addrResult as { address: string }).address;
      } else if (typeof addrResult === "string") {
        publicKey = addrResult;
      }
    } catch {
      // Permission not granted or user needs to reconnect
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
    } catch {
      // network info is optional
    }

    return { installed: true, connected: true, publicKey, network };
  } catch {
    return EMPTY_STATE;
  }
}
