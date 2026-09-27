import { getApiBaseUrl } from "./client";

export type UploadPdfResult = {
  message: string;
  fileName: string;
  bytes: number;
};

export async function uploadProjectPdf(file: File, signal?: AbortSignal): Promise<UploadPdfResult> {
  const apiBase = getApiBaseUrl();

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${apiBase}/api/documents/upload`, {
    method: "POST",
    body,
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Upload failed (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  return {
    message: payload?.message ?? "Upload complete.",
    fileName: file.name,
    bytes: file.size,
  };
}
