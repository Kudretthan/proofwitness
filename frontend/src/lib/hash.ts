/**
 * SHA-256 hash using the browser's native crypto.subtle API.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a short display version of a hash: first 8 chars + "..." + last 6 chars.
 */
export function shortHash(hash: string): string {
  if (!hash || hash.length < 16) return hash || "";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Build claim hash from claim fields.
 */
export async function buildClaimHash(fields: {
  title: string;
  description: string;
  location: string;
  incidentDate: string;
  incidentTime: string;
  category: string;
  creatorWallet: string;
  createdAt: string;
}): Promise<string> {
  const input = [
    fields.title,
    fields.description,
    fields.location,
    fields.incidentDate,
    fields.incidentTime,
    fields.category,
    fields.creatorWallet,
    fields.createdAt,
  ].join("|");
  return sha256(input);
}

/**
 * Build AI report hash.
 */
export async function buildAiReportHash(ai: object): Promise<string> {
  return sha256(JSON.stringify(ai));
}

/**
 * Build verification hash.
 */
export async function buildVerificationHash(fields: {
  claimId: string;
  verifierWallet: string;
  decision: string;
  note: string;
  evidenceUrl?: string;
  createdAt: string;
}): Promise<string> {
  const input = [
    fields.claimId,
    fields.verifierWallet,
    fields.decision,
    fields.note,
    fields.evidenceUrl || "",
    fields.createdAt,
  ].join("|");
  return sha256(input);
}
