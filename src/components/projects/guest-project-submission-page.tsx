"use client";

import { FormEvent, useMemo, useState } from "react";

import { licenseOptions } from "@/src/lib/makershelf-data";

type GuestProjectSubmissionPageProps = {
  token: string;
  label: string;
  workspaceName: string;
};

type SubmitResult = {
  guestUrl?: string;
  projectId?: string;
  fileCount?: number;
  error?: string;
};

export function GuestProjectSubmissionPage({ token, label, workspaceName }: GuestProjectSubmissionPageProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [license, setLicense] = useState("Unknown");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileSummary = useMemo(() => {
    if (files.length === 0) return "No files selected";
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const mb = totalBytes / 1024 / 1024;
    return `${files.length} file${files.length === 1 ? "" : "s"} · ${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }, [files]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setResult(null);

    if (!title.trim()) {
      setStatus("Please enter a project name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("author", author.trim() || "Guest");
      formData.set("license", license);
      formData.set("sourceUrl", sourceUrl.trim());
      formData.set("tags", tags.trim());
      files.forEach((file) => {
        formData.append("files", file, file.webkitRelativePath || file.name);
      });

      const response = await fetch(`/api/guest-submit/${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as SubmitResult;

      if (!response.ok) {
        throw new Error(payload.error || "Project could not be created.");
      }

      setResult(payload);
      try {
        await navigator.clipboard?.writeText(payload.guestUrl || "");
      } catch {
        // The success panel below still exposes the link when browser clipboard access is blocked.
      }
      setStatus("Project created. The link below is only valid for this project.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project could not be created.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="page-header">
        <div>
          <p className="text-sm text-muted">{workspaceName}</p>
          <h1 className="page-title">{label}</h1>
          <p className="page-subtitle">Create a new makershelf project here. You will automatically receive a guest link to the finished project.</p>
        </div>
      </div>

      {result?.guestUrl ? (
        <section className="panel panel-padded mb-5" style={{ borderColor: "var(--primary)" }}>
          <h2 className="section-title">Project guest link created</h2>
          <p className="text-sm text-muted">Share this link or open it directly. It only leads to this newly created project.</p>
          <div className="responsive-actions mt-3">
            <input className="input" readOnly value={result.guestUrl} onFocus={(event) => event.currentTarget.select()} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void navigator.clipboard?.writeText(result.guestUrl || "")}
            >
              Copy link
            </button>
            <a className="btn btn-primary" href={result.guestUrl}>
              View project
            </a>
          </div>
        </section>
      ) : null}

      <form className="panel panel-padded" onSubmit={(event) => void handleSubmit(event)}>
        <div className="responsive-filter-grid">
          <label className="form-field">
            <span>Project name</span>
            <input
              className="input"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Voron Toolhead Mount"
              required
            />
          </label>
          <label className="form-field">
            <span>Creator / Author</span>
            <input
              className="input"
              value={author}
              maxLength={160}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Name or platform handle"
            />
          </label>
          <label className="form-field">
            <span>License</span>
            <select className="input select" value={license} onChange={(event) => setLicense(event.target.value)}>
              {licenseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Source</span>
            <input
              className="input"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <label className="form-field mt-4">
          <span>Description</span>
          <textarea
            className="input"
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Brief description, print notes, special features..."
          />
        </label>

        <label className="form-field mt-4">
          <span>Tags</span>
          <input
            className="input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="comma-separated, e.g. voron, mount, abs"
          />
        </label>

        <div className="panel mt-4" style={{ padding: "16px", borderStyle: "dashed" }}>
          <label className="form-field">
            <span>Files</span>
            <input
              className="input"
              type="file"
              multiple
              // @ts-expect-error Browser-only folder upload attribute.
              webkitdirectory=""
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </label>
          <div className="responsive-actions mt-3">
            <label className="btn btn-secondary btn-sm">
              Select individual files
              <input
                type="file"
                multiple
                accept=".stl,.obj,.3mf,.step,.stp,.gcode,.amf,.ply,.pdf,.zip,.zipx,.rar,.7z,.tar,.tar.gz,.tgz,.tar.bz2,.tbz,.tbz2,.tar.xz,.txz,.tar.zst,.tzst,.gz,.bz2,.xz,.zst,.lz,.lzma,.lz4,.cab,.iso"
                style={{ display: "none" }}
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            <span className="badge badge-neutral">{fileSummary}</span>
          </div>
        </div>

        <div className="responsive-actions mt-5">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating project..." : "Create guest project"}
          </button>
          {status ? <span className="text-sm text-muted">{status}</span> : null}
        </div>
      </form>

    </main>
  );
}
