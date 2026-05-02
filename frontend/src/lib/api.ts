export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export async function analyzeClaim(payload: {
  title: string;
  description: string;
  location: string;
  incidentDate: string;
  incidentTime: string;
  category: string;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/analyze-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        errBody.error || `Server responded with status ${res.status}`
      );
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(
        "Cannot reach the backend. Make sure the server is running on " +
          API_BASE_URL,
        { cause: err }
      );
    }
    throw err;
  }
}

export async function uploadEvidence(file: File) {
  try {
    const formData = new FormData();
    formData.append("evidence", file);

    const res = await fetch(`${API_BASE_URL}/api/upload-evidence`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Upload failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(
        "Cannot reach the backend. Make sure the server is running on " +
          API_BASE_URL,
        { cause: err }
      );
    }
    throw err;
  }
}
