"use client";
import { useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  Folder,
  Plus,
  Search,
  Trash2,
  Upload,
  ArrowUpRight,
} from "lucide-react";
import type { Collection, Library, Paper } from "@/lib/domain";
import { api, errorMessage, safeLink } from "@/lib/client";
import {
  Button,
  Empty,
  ErrorBox,
  IconButton,
  Loading,
  Modal,
} from "./ui/primitives";
export function LibraryRail({
  library,
  activeId,
  onOpen,
  onImport,
  onLibrary,
  onError,
}: {
  library: Library;
  activeId?: string;
  onOpen: (id: string) => void;
  onImport: () => void;
  onLibrary: () => void;
  onError: (message: string) => void;
}) {
  return (
    <aside className="library-rail">
      <button className="brand" onClick={onLibrary}>
        <BookOpen size={24} />
        <span>
          Paper reader<span className="brand-caption">Your research desk</span>
        </span>
      </button>
      <Button className="primary" onClick={onImport}>
        <Plus size={16} /> Add paper
      </Button>
      <button className="rail-heading" onClick={onLibrary}>
        Library <span>{library.papers.length}</span>
      </button>
      <nav aria-label="Recent papers" className="paper-nav">
        {library.papers
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((paper) => (
            <button
              key={paper.id}
              className={paper.id === activeId ? "active" : ""}
              onClick={() => onOpen(paper.id)}
            >
              <FileText size={17} />
              <span>
                {paper.title}
                <small>
                  {paper.authors[0] ?? "Unknown author"}
                  {paper.year ? `, ${paper.year}` : ""}
                </small>
              </span>
            </button>
          ))}
      </nav>
      <div className="rail-bottom">
        <span className="status-dot" /> Private reading workspace
        <Button
          onClick={() => {
            navigator.clipboard
              ?.writeText(window.location.href)
              .catch((error) => onError(errorMessage(error)));
          }}
        >
          Copy workspace link
        </Button>
      </div>
    </aside>
  );
}
export function LibraryView({
  library,
  onOpen,
  onImport,
  refresh,
}: {
  library: Library;
  onOpen: (id: string) => void;
  onImport: () => void;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const tags = Array.from(
    new Set(library.papers.flatMap((p) => p.tags)),
  ).sort();
  const papers = useMemo(
    () =>
      library.papers
        .filter(
          (p) =>
            `${p.title} ${p.authors.join(" ")} ${p.doi ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (!collection || p.collectionIds.includes(collection)) &&
            (!tag || p.tags.includes(tag)),
        )
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "year"
              ? (b.year ?? 0) - (a.year ?? 0)
              : b.createdAt - a.createdAt,
        ),
    [library.papers, query, collection, tag, sort],
  );
  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.collection(name.trim(), "#3158a0");
      await refresh();
      setCreating(false);
      setName("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteCollection(deleting.id);
      setCollection("");
      await refresh();
      setDeleting(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="library-view">
      <header className="library-heading">
        <div>
          <p className="muted">A place to read, understand, and remember.</p>
          <h1>Your library</h1>
        </div>
        <Button className="primary" onClick={onImport}>
          <Upload size={17} />
          Import paper
        </Button>
      </header>
      <div className="library-filters">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search library"
            placeholder="Search titles, authors, DOI…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Sort papers"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="year">Newest publication</option>
        </select>
        <select
          aria-label="Filter by tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="collection-tabs">
        <Button
          className={!collection ? "selected" : ""}
          onClick={() => setCollection("")}
        >
          All papers <span>{library.papers.length}</span>
        </Button>
        {library.collections.map((c) => (
          <span className="collection-tab" key={c.id}>
            <Button
              className={collection === c.id ? "selected" : ""}
              onClick={() => setCollection(c.id)}
            >
              <Folder size={14} />
              {c.name}
            </Button>
            <IconButton
              label={`Delete collection ${c.name}`}
              onClick={() => setDeleting(c)}
            >
              <Trash2 size={13} />
            </IconButton>
          </span>
        ))}
        <Button onClick={() => setCreating(true)}>
          <Plus size={14} />
          Collection
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      <p className="muted">
        {papers.length} {papers.length === 1 ? "paper" : "papers"}
        {collection ? " in this collection" : ""}
      </p>
      {papers.length === 0 ? (
        <Empty
          title={
            library.papers.length
              ? "No matching papers"
              : "Make room for your next idea"
          }
        >
          <p>
            {library.papers.length
              ? "Try another search or collection."
              : "Add a PDF, DOI, arXiv ID or public paper URL to begin reading."}
          </p>
          <Button onClick={onImport} className="primary">
            Add your first paper
          </Button>
        </Empty>
      ) : (
        <div className="library-list">
          {papers.map((p) => (
            <button
              key={p.id}
              className="paper-row"
              onClick={() => onOpen(p.id)}
            >
              <div className="paper-cover">
                <FileText size={27} />
                <span>PDF</span>
              </div>
              <div className="paper-details">
                <h2>{p.title}</h2>
                <p>{p.authors.join(", ") || "Author metadata unavailable"}</p>
                <div className="paper-meta">
                  {p.year ?? "Year unavailable"} <span>{p.venue}</span>
                  {p.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <progress
                  aria-label={`${p.title} reading progress`}
                  max={1}
                  value={Math.min(1, Math.max(0, p.progress))}
                />
              </div>
              <div className="paper-status">
                <span>
                  {p.status === "ready" ? `${p.pages.length} pages` : p.status}
                </span>
                <span>{Math.round(p.progress * 100)}% read</span>
                <ArrowUpRight size={18} />
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="New collection"
        description="Group papers around a research question."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          {error && <ErrorBox message={error} />}
          <label>
            Collection name
            <input
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <Button type="submit" className="primary" disabled={busy}>
            Create collection
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete collection?"
        description="The papers in this collection stay in your library."
      >
        <p>{deleting?.name}</p>
        {error && <ErrorBox message={error} />}
        <Button
          className="danger"
          onClick={() => void remove()}
          disabled={busy}
        >
          Delete collection
        </Button>
      </Modal>
    </main>
  );
}
export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (paper: Paper) => Promise<void>;
}) {
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  function choose(candidate: File | undefined) {
    setError("");
    if (!candidate) return;
    if (candidate.size > 25 * 1024 * 1024) {
      setError("Choose a PDF smaller than 25 MB.");
      return;
    }
    if (!candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    setFile(candidate);
  }
  async function submit() {
    if (!file && !source.trim()) return;
    setBusy(true);
    setError("");
    setPercent(0);
    try {
      const paper = await api.import(file ?? source.trim(), setPercent);
      await onImported(paper);
      setFile(null);
      setSource("");
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
      title="Add a paper"
      description="Upload a PDF or import from a DOI, arXiv ID or public URL."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label
          className={`drop-zone ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) choose(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={28} />
          <strong>{file?.name ?? "Drop a PDF here"}</strong>
          <span>or choose a file · maximum 25 MB</span>
          <input
            type="file"
            aria-label="Upload PDF"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        {file && (
          <Button onClick={() => setFile(null)} disabled={busy}>
            Use a link instead
          </Button>
        )}
        <label>
          DOI, arXiv ID or public URL
          <input
            placeholder="10.48550/arXiv.1706.03762"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={busy || !!file}
          />
        </label>
        {error && <ErrorBox message={error} retry={() => void submit()} />}
        {busy && (
          <>
            <Loading
              text={
                file && percent < 100
                  ? `Uploading ${percent}%`
                  : "Extracting and indexing your paper…"
              }
            />
            {file && (
              <progress
                max={100}
                value={percent}
                aria-label="Upload progress"
              />
            )}
          </>
        )}
        <Button
          className="primary"
          type="submit"
          disabled={busy || (!file && !source.trim())}
        >
          Import paper
        </Button>
        <p className="muted">
          Imports stay in this workspace. Scanned PDFs may need OCR before text
          can be selected.
        </p>
      </form>
    </Modal>
  );
}
export function MetadataDialog({
  paper,
  collections,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  paper: Paper;
  collections: Collection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (paper: Paper) => void;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(paper);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.paper(paper.id, {
        title: draft.title,
        authors: draft.authors,
        abstract: draft.abstract,
        year: draft.year,
        venue: draft.venue,
        doi: draft.doi,
        tags: draft.tags,
        collectionIds: draft.collectionIds,
      });
      onSave(updated);
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Paper details"
      description="Correct metadata and organize this paper."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Title
          <input
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Authors (one per line)
          <textarea
            value={draft.authors.join("\n")}
            onChange={(e) =>
              setDraft({ ...draft, authors: e.target.value.split("\n") })
            }
          />
        </label>
        <div className="form-row">
          <label>
            Year
            <input
              type="number"
              min="1000"
              max="9999"
              value={draft.year ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  year: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </label>
          <label>
            Venue
            <input
              value={draft.venue}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
            />
          </label>
        </div>
        <label>
          DOI
          <input
            value={draft.doi ?? ""}
            onChange={(e) => setDraft({ ...draft, doi: e.target.value })}
          />
        </label>
        <label>
          Abstract
          <textarea
            rows={4}
            value={draft.abstract}
            onChange={(e) => setDraft({ ...draft, abstract: e.target.value })}
          />
        </label>
        <label>
          Tags (comma separated)
          <input
            value={draft.tags.join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                tags: e.target.value.split(",").map((t) => t.trim()),
              })
            }
          />
        </label>
        <fieldset>
          <legend>Collections</legend>
          {collections.map((c) => (
            <label className="check-label" key={c.id}>
              <input
                type="checkbox"
                checked={draft.collectionIds.includes(c.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    collectionIds: e.target.checked
                      ? [...draft.collectionIds, c.id]
                      : draft.collectionIds.filter((id) => id !== c.id),
                  })
                }
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <p className="muted">
          Source:{" "}
          {safeLink(paper.sourceUrl) ? (
            <a
              href={safeLink(paper.sourceUrl)}
              target="_blank"
              rel="noreferrer"
            >
              {paper.sourceUrl}
            </a>
          ) : (
            "Uploaded PDF"
          )}
        </p>
        {error && <ErrorBox message={error} />}
        <div className="form-row">
          <Button type="submit" className="primary" disabled={busy}>
            Save changes
          </Button>
          <Button
            className="danger"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Delete paper…
          </Button>
        </div>
      </form>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete paper?"
        description="This permanently removes the paper and its saved reading data."
      >
        {error && <ErrorBox message={error} />}
        <Button
          className="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onDelete()
              .catch((e) => setError(errorMessage(e)))
              .finally(() => setBusy(false));
          }}
        >
          Delete paper permanently
        </Button>
      </Modal>
    </Modal>
  );
}
