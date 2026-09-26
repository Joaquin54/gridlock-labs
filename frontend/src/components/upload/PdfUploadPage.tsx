import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { uploadProjectPdf } from "../../api/documents";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import { formatFileSize } from "../../utils/format";
import {
  CLS_BUTTON_PRIMARY,
  CLS_BUTTON_SECONDARY,
  CLS_FIELD_LABEL,
} from "../../utils/formFieldStyles";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const PDF_ACCEPT = ".pdf,application/pdf";

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

function validatePdf(file: File): string | null {
  if (!isPdfFile(file)) return "Only PDF files are allowed.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_PDF_BYTES) {
    return `File is too large (max ${formatFileSize(MAX_PDF_BYTES)}).`;
  }
  return null;
}

export default function PdfUploadPage() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const setChosenFile = useCallback((next: File | null) => {
    setSuccess(null);
    if (!next) {
      setFile(null);
      setError(null);
      return;
    }
    const validationError = validatePdf(next);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(next);
    setError(null);
  }, []);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setChosenFile(picked);
    event.target.value = "";
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    setChosenFile(dropped);
  };

  const clearFile = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setChosenFile(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || uploading) return;

    setError(null);
    setSuccess(null);
    setUploading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploadProjectPdf(file, controller.signal);
      setSuccess(result.message);
      setFile(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col">
      <div className="mb-3 flex flex-col gap-1">
        <h1 className="m-0 text-[1.05rem] font-semibold leading-tight text-text-primary">
          Upload project PDF
        </h1>
        <p className="m-0 text-[0.8125rem] leading-snug text-text-secondary">
          Add Dominion or Georgia Power listing documents. PDF only, up to{" "}
          {formatFileSize(MAX_PDF_BYTES)} per file.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col items-stretch gap-[0.4rem] rounded-lg border border-border bg-surface px-3 pt-2.5 pb-3"
      >
        <span className={CLS_FIELD_LABEL}>Document</span>

        <button
          type="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex min-h-[9.5rem] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center font-sans transition-[border-color,background] duration-150",
            dragOver
              ? "border-accent bg-accent-light"
              : "border-border-input bg-bg hover:border-border-strong hover:bg-surface-hover",
          )}
          aria-label="Drop a PDF here or browse files"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-text-muted"
            aria-hidden="true"
          >
            <path
              d="M12 16V8m0 0l-3 3m3-3l3 3M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2h-5.5L11 3H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="m-0 text-[0.875rem] font-medium text-text-primary">
            Drop PDF here or click to browse
          </p>
          <p className="m-0 text-[0.75rem] text-text-muted">application/pdf · .pdf</p>
        </button>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PDF_ACCEPT}
          className="sr-only"
          onChange={onInputChange}
        />

        {file ? (
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-1 !px-3 !py-3 !pb-3")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Selected file</div>
            <div className="rounded-md border border-border bg-bg px-2.5 py-2">
              <p className="m-0 truncate text-[0.8125rem] font-medium text-text-primary">
                {file.name}
              </p>
              <p className="m-0 mt-1 font-mono text-[0.6875rem] text-text-muted">
                {formatFileSize(file.size)}
              </p>
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="m-0 px-0.5 text-[0.8125rem] text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            className="m-0 rounded-md border border-green/30 bg-green-light px-3 py-2 text-[0.8125rem] text-green dark:border-green/40"
            role="status"
          >
            {success}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="submit"
            className={CLS_BUTTON_PRIMARY}
            disabled={!file || uploading}
            aria-busy={uploading}
          >
            {uploading ? "Uploading…" : "Upload PDF"}
          </button>
          <button
            type="button"
            className={CLS_BUTTON_SECONDARY}
            onClick={clearFile}
            disabled={!file && !error}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
