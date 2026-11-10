"use client";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  useMemo,
  useCallback,
  type Ref,
  type CSSProperties,
} from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import type { PageViewport } from "pdfjs-dist/types/src/display/page_viewport";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Minus,
  Plus,
  RotateCw,
  Search,
  X,
  Scan,
} from "lucide-react";
import type {
  Annotation,
  Paper,
  PassageCitation,
  Rect,
  Reference,
  Settings,
} from "@/lib/domain";
import {
  api,
  errorMessage,
  pdfPath,
  referencePreviewPath,
  safeLink,
} from "@/lib/client";
import type { CommandId } from "@/lib/shortcuts";
import {
  Button,
  ErrorBox,
  IconButton,
  Loading,
  HoverPopover,
} from "./ui/primitives";
import { indexTextLayer, normalizeSearch } from "./pdf-text";
import {
  paragraphContext,
  internalReferenceTarget,
} from "@/lib/reader-context";
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
export type ReadingSelection = {
  paperId: string;
  text: string;
  context: string;
  page: number;
  rects: Rect[];
};
export type ReaderHandle = {
  run: (command: CommandId) => void;
  jump: (citation: PassageCitation) => void;
};
type ViewTarget = { page: number; rects: Rect[]; nonce: number };
type Match = { page: number; start: number; length: number; ordinal: number };
export function viewportRect(
  rect: Rect,
  viewport: PageViewport,
  pageHeight: number,
): Rect {
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ].map(([x = 0, y = 0]) => viewport.convertToViewportPoint(x, pageHeight - y));
  const xs = points.map((p) => p[0] ?? 0);
  const ys = points.map((p) => p[1] ?? 0);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
function rectStyle(rect: Rect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}
function selectionRects(
  range: Range,
  element: HTMLElement,
  viewport: PageViewport,
  pageHeight: number,
): Rect[] {
  const bounds = element.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter(
      (r) =>
        r.width > 0 &&
        r.height > 0 &&
        r.left >= bounds.left - 1 &&
        r.top >= bounds.top - 1 &&
        r.bottom <= bounds.bottom + 1,
    )
    .map((rect) => {
      const points = [
        [rect.left - bounds.left, rect.top - bounds.top],
        [rect.right - bounds.left, rect.bottom - bounds.top],
      ].map(([x = 0, y = 0]) => viewport.convertToPdfPoint(x, y));
      const a = points[0] ?? [0, 0];
      const b = points[1] ?? [0, 0];
      return {
        x: Math.min(a[0] ?? 0, b[0] ?? 0),
        y: pageHeight - Math.max(a[1] ?? 0, b[1] ?? 0),
        width: Math.abs((a[0] ?? 0) - (b[0] ?? 0)),
        height: Math.abs((a[1] ?? 0) - (b[1] ?? 0)),
      };
    });
}
export function PdfReader({
  paper,
  annotations,
  settings,
  onPage,
  onSelection,
  onReferenceImport,
  readerRef,
  compact = false,
  onActive,
  onReady,
}: {
  paper: Paper;
  annotations: Annotation[];
  settings: Settings;
  onPage: (page: number) => void;
  onSelection: (selection: ReadingSelection) => void;
  onReferenceImport: (source: string) => Promise<void>;
  readerRef?: Ref<ReaderHandle>;
  compact?: boolean;
  onActive?: () => void;
  onReady?: () => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(Math.max(1, paper.currentPage));
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"width" | "page" | "custom">("width");
  const [rotation, setRotation] = useState(0);
  const [navigation, setNavigation] = useState<"outline" | "thumbnails" | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [target, setTarget] = useState<ViewTarget | null>(null);
  const [size, setSize] = useState({ width: 700, height: 800 });
  const area = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const pageInput = useRef<HTMLInputElement>(null);
  const pageRef = useRef(page);
  const onPageRef = useRef(onPage);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onPageRef.current = onPage;
    onReadyRef.current = onReady;
  }, [onPage, onReady]);
  const [resumePage] = useState(paper.currentPage);
  useEffect(() => {
    let alive = true;
    const task = getDocument({
      url: pdfPath(paper.id),
    });
    void task.promise
      .then((pdf) => {
        if (alive) {
          setDoc(pdf);
          setTimeout(() => onReadyRef.current?.(), 0);
        }
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
      void task.destroy();
    };
  }, [paper.id, attempt]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect)
        setSize({
          width: Math.max(120, rect.width - 48),
          height: Math.max(150, rect.height - 48),
        });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const total = doc?.numPages ?? Math.max(1, paper.pages.length);
  const matches = useMemo<Match[]>(() => {
    if (!query.trim()) return [];
    const needle = normalizeSearch(query);
    return paper.pages.flatMap((p) => {
      const found: Match[] = [];
      const text = normalizeSearch(p.text);
      let index = text.indexOf(needle);
      while (index >= 0 && found.length < 1000) {
        found.push({
          page: p.number,
          start: index,
          length: needle.length,
          ordinal: found.length,
        });
        index = text.indexOf(needle, index + needle.length);
      }
      return found;
    });
  }, [query, paper.pages]);
  const jumpPage = useCallback(
    (next: number) => {
      const value = Math.min(total, Math.max(1, next));
      setPage(value);
      pageRef.current = value;
      onPageRef.current(value);
      requestAnimationFrame(() =>
        area.current
          ?.querySelector(`[data-page-number="${value}"]`)
          ?.scrollIntoView({ block: "start", behavior: "instant" }),
      );
    },
    [total],
  );
  function nextMatch(direction: number) {
    if (!matches.length) return;
    const index = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(index);
    const item = matches[index];
    if (item) jumpPage(item.page);
  }
  useEffect(() => {
    if (!doc || settings.readingMode !== "continuous") return;
    const root = area.current;
    if (!root) return;
    const intersections = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersections.set(entry.target, entry);
          else intersections.delete(entry.target);
        }
        const visible = [...intersections.values()].sort(
          (a, b) => b.intersectionRatio - a.intersectionRatio,
        )[0];
        if (visible) {
          const next = Number(visible.target.getAttribute("data-page-number"));
          if (next !== pageRef.current) {
            pageRef.current = next;
            setPage(next);
            onPageRef.current(next);
          }
        }
      },
      { root, threshold: [0.15, 0.5, 0.8] },
    );
    root
      .querySelectorAll("[data-page-number]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [doc, settings.readingMode, rotation, zoom, fit]);
  useEffect(() => {
    if (!doc) return;
    requestAnimationFrame(() =>
      area.current
        ?.querySelector(`[data-page-number="${resumePage}"]`)
        ?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  }, [doc, resumePage]);
  useEffect(() => {
    if (!target) return;
    const timer = setTimeout(() => setTarget(null), 2400);
    return () => clearTimeout(timer);
  }, [target]);
  useImperativeHandle(readerRef, () => ({
    jump(citation) {
      jumpPage(citation.page);
      setTarget({
        page: citation.page,
        rects: citation.rects,
        nonce: Date.now(),
      });
    },
    run(command) {
      switch (command) {
        case "scrollDown":
          area.current?.scrollBy({ top: 160, behavior: "instant" });
          break;
        case "scrollUp":
          area.current?.scrollBy({ top: -160, behavior: "instant" });
          break;
        case "first":
          jumpPage(1);
          break;
        case "last":
          jumpPage(total);
          break;
        case "next":
          jumpPage(page + 1);
          break;
        case "previous":
          jumpPage(page - 1);
          break;
        case "zoomIn":
          setFit("custom");
          setZoom((v) => Math.min(3, v + 0.15));
          break;
        case "zoomOut":
          setFit("custom");
          setZoom((v) => Math.max(0.3, v - 0.15));
          break;
        case "zoomReset":
          setFit("custom");
          setZoom(1);
          break;
        case "fitWidth":
          setFit("width");
          break;
        case "fitPage":
          setFit("page");
          break;
        case "rotate":
          setRotation((v) => (v + 90) % 360);
          break;
        case "outline":
          setNavigation((v) => (v === "outline" ? null : "outline"));
          break;
        case "thumbnails":
          setNavigation((v) => (v === "thumbnails" ? null : "thumbnails"));
          break;
        case "search":
        case "searchGlobal":
          setSearchOpen(true);
          setTimeout(() => search.current?.focus(), 0);
          break;
        case "searchNext":
          nextMatch(1);
          break;
        case "searchPrevious":
          nextMatch(-1);
          break;
        case "escape":
          setSearchOpen(false);
          setNavigation(null);
          area.current?.focus();
          break;
      }
    },
  }));
  const selectedMatch = matches[matchIndex];
  // Inferred headings come from the ingestion spans, without inventing an outline.
  const outline = paper.outline.length
    ? paper.outline
    : paper.pages.flatMap((p) =>
        p.spans
          .filter(
            (s) => s.fontSize >= 14 && s.text.length > 3 && s.text.length < 110,
          )
          .slice(0, 6)
          .map((s) => ({ title: s.text, page: p.number, depth: 0 })),
      );
  return (
    <section
      className={`pdf-reader ${compact ? "compact" : ""}`}
      aria-label={`PDF reader: ${paper.title}`}
      onPointerDown={onActive}
      onFocus={onActive}
    >
      <div className="reader-toolbar">
        <div className="toolbar-group">
          <IconButton
            label="Outline"
            aria-pressed={navigation === "outline"}
            onClick={() =>
              setNavigation((v) => (v === "outline" ? null : "outline"))
            }
          >
            <List size={17} />
          </IconButton>
          <IconButton
            label="Thumbnails"
            aria-pressed={navigation === "thumbnails"}
            onClick={() =>
              setNavigation((v) => (v === "thumbnails" ? null : "thumbnails"))
            }
          >
            <BookOpen size={17} />
          </IconButton>
          <IconButton
            label="Search document"
            onClick={() => {
              setSearchOpen((v) => !v);
              setTimeout(() => search.current?.focus(), 0);
            }}
          >
            <Search size={17} />
          </IconButton>
        </div>
        <div className="toolbar-group page-control">
          <IconButton
            label="Previous page"
            onClick={() => jumpPage(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              jumpPage(Number(pageInput.current?.value) || page);
            }}
          >
            <input
              key={page}
              ref={pageInput}
              aria-label="Page number"
              type="number"
              min={1}
              max={total}
              defaultValue={page}
            />
          </form>
          <span>/ {total}</span>
          <IconButton
            label="Next page"
            onClick={() => jumpPage(page + 1)}
            disabled={page >= total}
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
        <div className="toolbar-group">
          <IconButton
            label="Zoom out"
            onClick={() => {
              setFit("custom");
              setZoom((v) => Math.max(0.3, v - 0.15));
            }}
          >
            <Minus size={16} />
          </IconButton>
          <select
            aria-label="Zoom and fit"
            value={fit === "custom" ? String(zoom) : fit}
            onChange={(e) => {
              if (e.target.value === "width" || e.target.value === "page")
                setFit(e.target.value);
              else {
                setFit("custom");
                setZoom(Number(e.target.value));
              }
            }}
          >
            <option value="width">Fit width</option>
            <option value="page">Fit page</option>
            {Array.from(new Set([0.5, 0.75, 1, 1.25, 1.5, 2, 3, zoom]))
              .sort((a, b) => a - b)
              .map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)}%
                </option>
              ))}
          </select>
          <IconButton
            label="Zoom in"
            onClick={() => {
              setFit("custom");
              setZoom((v) => Math.min(3, v + 0.15));
            }}
          >
            <Plus size={16} />
          </IconButton>
          <IconButton
            label="Rotate clockwise"
            onClick={() => setRotation((v) => (v + 90) % 360)}
          >
            <RotateCw size={16} />
          </IconButton>
          <a
            className="button"
            href={pdfPath(paper.id)}
            download
            aria-label="Download original PDF"
          >
            <Download size={16} />
          </a>
        </div>
      </div>
      {searchOpen && (
        <div className="pdf-search">
          <Search size={15} />
          <input
            ref={search}
            data-pdf-search="true"
            aria-label="Search PDF text"
            placeholder="Find in paper…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchIndex(0);
              const match = paper.pages.find((p) =>
                p.text.toLowerCase().includes(e.target.value.toLowerCase()),
              );
              if (match && e.target.value) jumpPage(match.number);
            }}
          />
          <output aria-live="polite">
            {matches.length
              ? `${matchIndex + 1} / ${matches.length}`
              : query
                ? "No matches"
                : ""}
          </output>
          <IconButton
            label="Previous search match"
            onClick={() => nextMatch(-1)}
          >
            <ArrowUp size={15} />
          </IconButton>
          <IconButton label="Next search match" onClick={() => nextMatch(1)}>
            <ArrowDown size={15} />
          </IconButton>
          <IconButton label="Close search" onClick={() => setSearchOpen(false)}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      <div className="reader-body">
        {navigation && (
          <aside className="document-navigation" aria-label={navigation}>
            <header>
              <strong>{navigation === "outline" ? "Contents" : "Pages"}</strong>
              <IconButton
                label="Close document navigation"
                onClick={() => setNavigation(null)}
              >
                <X size={15} />
              </IconButton>
            </header>
            {navigation === "outline" ? (
              outline.length ? (
                outline.map((item, index) => (
                  <button
                    key={index}
                    style={{ paddingLeft: 12 + Math.min(item.depth, 4) * 12 }}
                    onClick={() => jumpPage(item.page)}
                  >
                    {item.title}
                    <small>{item.page}</small>
                  </button>
                ))
              ) : (
                <p className="muted">No outline or detectable headings.</p>
              )
            ) : (
              doc &&
              Array.from({ length: total }, (_, i) => (
                <button
                  className={page === i + 1 ? "active-thumbnail" : ""}
                  key={i}
                  onClick={() => jumpPage(i + 1)}
                >
                  <Thumbnail doc={doc} number={i + 1} />
                  <span>Page {i + 1}</span>
                </button>
              ))
            )}
          </aside>
        )}
        <div
          ref={area}
          className={`pdf-scroll ${settings.pageAppearance ? "recolor-pages" : ""}`}
          tabIndex={0}
          aria-label="Scrollable PDF pages"
        >
          {error ? (
            <ErrorBox
              message={error}
              retry={() => {
                setError("");
                setAttempt((v) => v + 1);
              }}
            />
          ) : !doc ? (
            <Loading text="Opening PDF…" />
          ) : (
            <>
              {paper.pages.every((p) => !p.text.trim()) && (
                <div className="scan-notice">
                  <Scan size={17} />
                  No searchable text was extracted. This PDF may require OCR.
                </div>
              )}
              {Array.from({ length: total }, (_, i) => i + 1)
                .filter(
                  (number) =>
                    settings.readingMode === "continuous" || number === page,
                )
                .map((number) => (
                  <PdfPage
                    key={number}
                    doc={doc}
                    number={number}
                    paper={paper}
                    width={size.width}
                    maxHeight={size.height}
                    zoom={zoom}
                    fit={fit}
                    rotation={rotation}
                    annotations={annotations.filter((a) => a.page === number)}
                    query={query}
                    activeMatch={
                      selectedMatch?.page === number ? selectedMatch : undefined
                    }
                    target={target?.page === number ? target : undefined}
                    onSelection={onSelection}
                    onJump={jumpPage}
                    onReferenceImport={onReferenceImport}
                  />
                ))}
            </>
          )}
        </div>
      </div>
      <footer className="reader-footer">
        <span>
          Page {page} of {total}
        </span>
        <progress aria-label="Reading progress" value={page} max={total} />
        <span>{Math.round((page / total) * 100)}%</span>
      </footer>
    </section>
  );
}
function Thumbnail({
  doc,
  number,
  previewWidth = 128,
}: {
  doc: PDFDocumentProxy;
  number: number;
  previewWidth?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let canceled = false;
    let render: ReturnType<PDFPageProxy["render"]> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void doc
          .getPage(number)
          .then((page) => {
            if (canceled || !canvas.current) return;
            const viewport = page.getViewport({
              scale: previewWidth / page.getViewport({ scale: 1 }).width,
            });
            canvas.current.width = viewport.width;
            canvas.current.height = viewport.height;
            render = page.render({ canvas: canvas.current, viewport });
            return render.promise;
          })
          .catch(() => {});
      },
      { rootMargin: "200px" },
    );
    if (holder.current) observer.observe(holder.current);
    return () => {
      canceled = true;
      render?.cancel();
      observer.disconnect();
    };
  }, [doc, number, previewWidth]);
  return (
    <span ref={holder} className="thumbnail">
      <canvas ref={canvas} aria-label={`Thumbnail of page ${number}`} />
    </span>
  );
}
type PreviewAnchor =
  | {
      rect: Rect;
      label: string;
      kind: "reference";
      reference: Reference;
      references: Reference[];
    }
  | {
      rect: Rect;
      label: string;
      kind: "internal";
      page: number;
      context: string;
    };
function previewAnchors(
  paper: Pick<Paper, "pages" | "references">,
  number: number,
  indexed: ReturnType<typeof indexTextLayer>,
  element: HTMLElement,
  viewport: PageViewport,
  pageHeight: number,
): PreviewAnchor[] {
  const page = paper.pages.find((p) => p.number === number);
  if (!page) return [];
  const result: PreviewAnchor[] = [];
  {
    const span = { text: indexed.text };
    const patterns =
      /\[(\d+(?:\s*[,–-]\s*\d+)*)\]|\b([A-Z][\p{L}'-]+)(?:\s+et\s+al\.?)?\s*\(?(\d{4})\)?|\b(Fig(?:ure)?\.?|Table|Eq(?:uation)?\.?)\s*\(?([\d]+[a-z]?)\)?|[⁰¹²³⁴⁵⁶⁷⁸⁹]+/gu;
    for (const match of span.text.matchAll(patterns)) {
      const range = indexed.range(match.index, match[0].length);
      if (!range) continue;
      const rect = selectionRects(range, element, viewport, pageHeight)[0];
      if (!rect) continue;
      if (match[4]) {
        const label = `${match[4]} ${match[5]}`;
        const kind = match[4].toLowerCase().startsWith("fig")
          ? "fig"
          : match[4].toLowerCase().startsWith("tab")
            ? "table"
            : "eq";
        const candidate = internalReferenceTarget(paper, kind, match[5] ?? "");
        if (candidate)
          result.push({
            kind: "internal",
            rect,
            label,
            page: candidate.page,
            context: paragraphContext(
              paper,
              candidate.page,
              candidate.span.text,
              [candidate.span.rect],
            ),
          });
      } else {
        const numeric =
          match[1] ??
          match[0].replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) =>
            String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)),
          );
        const labels = new Set(
          Array.from(numeric.matchAll(/(\d+)(?:\s*[–-]\s*(\d+))?/g)).flatMap(
            (part) => {
              const from = Number(part[1]);
              const to = part[2] ? Math.min(Number(part[2]), from + 100) : from;
              return Array.from(
                { length: Math.max(0, to - from + 1) },
                (_, i) => String(from + i),
              );
            },
          ),
        );
        const references = match[2]
          ? paper.references.filter(
              (r) =>
                r.year === Number(match[3]) &&
                r.authors.some((a) =>
                  a.toLowerCase().includes((match[2] ?? "").toLowerCase()),
                ),
            )
          : paper.references.filter((r) =>
              labels.has(r.label.replace(/\D/g, "")),
            );
        const reference = references[0] ?? {
          id: "unresolved",
          label: match[0],
          raw: "This citation could not be linked to an extracted bibliography entry. Check the References panel or original PDF.",
          title: "Unresolved citation",
          authors: [],
        };
        result.push({
          kind: "reference",
          rect,
          label: match[0],
          reference,
          references,
        });
      }
    }
  }
  for (const superscript of indexed.superscripts) {
    const range = indexed.range(superscript.start, superscript.length);
    if (!range) continue;
    const rect = selectionRects(range, element, viewport, pageHeight)[0];
    if (!rect) continue;
    const reference = paper.references.find(
      (item) => item.label.replace(/\D/g, "") === superscript.text,
    );
    if (reference)
      result.push({
        kind: "reference",
        rect,
        label: superscript.text,
        reference,
        references: [reference],
      });
  }
  return result.slice(0, 150);
}
function PdfPage({
  doc,
  number,
  paper,
  width,
  maxHeight,
  zoom,
  fit,
  rotation,
  annotations,
  query,
  activeMatch,
  target,
  onSelection,
  onJump,
  onReferenceImport,
}: {
  doc: PDFDocumentProxy;
  number: number;
  paper: Paper;
  width: number;
  maxHeight: number;
  zoom: number;
  fit: "width" | "page" | "custom";
  rotation: number;
  annotations: Annotation[];
  query: string;
  activeMatch?: Match;
  target?: ViewTarget;
  onSelection: (selection: ReadingSelection) => void;
  onJump: (page: number) => void;
  onReferenceImport: (source: string) => Promise<void>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const layer = useRef<TextLayer | null>(null);
  const viewport = useRef<PageViewport | null>(null);
  const [view, setView] = useState<PageViewport | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [anchors, setAnchors] = useState<PreviewAnchor[]>([]);
  const [base, setBase] = useState({
    width: paper.pages[number - 1]?.width ?? 612,
    height: paper.pages[number - 1]?.height ?? 792,
  });
  const [near, setNear] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [searchRects, setSearchRects] = useState<
    { rect: Rect; active: boolean }[]
  >([]);
  const rotated = rotation % 180 !== 0;
  const scale =
    fit === "width"
      ? width / (rotated ? base.height : base.width)
      : fit === "page"
        ? Math.min(
            width / (rotated ? base.height : base.width),
            maxHeight / (rotated ? base.width : base.height),
          )
        : zoom;
  const displayWidth = (rotated ? base.height : base.width) * scale;
  const displayHeight = (rotated ? base.width : base.height) * scale;
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setNear(visible);
        if (!visible) {
          setReady(false);
          if (canvas.current) {
            canvas.current.width = 0;
            canvas.current.height = 0;
          }
        }
      },
      { rootMargin: "700px" },
    );
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let canceled = false;
    let render: ReturnType<PDFPageProxy["render"]> | undefined;
    let currentLayer: TextLayer | undefined;
    void doc
      .getPage(number)
      .then(async (page) => {
        if (canceled || !canvas.current || !text.current) return;
        const original = page.getViewport({ scale: 1 });
        setBase({ width: original.width, height: original.height });
        const view = page.getViewport({ scale, rotation });
        viewport.current = view;
        const output = Math.min(window.devicePixelRatio || 1, 2);
        canvas.current.width = Math.ceil(view.width * output);
        canvas.current.height = Math.ceil(view.height * output);
        canvas.current.style.width = `${view.width}px`;
        canvas.current.style.height = `${view.height}px`;
        text.current.replaceChildren();
        text.current.style.setProperty("--total-scale-factor", String(scale));
        text.current.style.setProperty("--scale-factor", String(scale));
        text.current.style.setProperty("--scale-round-x", "1px");
        text.current.style.setProperty("--scale-round-y", "1px");
        render = page.render({
          canvas: canvas.current,
          viewport: view,
          transform: output !== 1 ? [output, 0, 0, output, 0, 0] : undefined,
        });
        await render.promise;
        if (canceled) return;
        const content = await page.getTextContent();
        if (canceled) return;
        currentLayer = new TextLayer({
          textContentSource: content,
          container: text.current,
          viewport: view,
        });
        layer.current = currentLayer;
        await currentLayer.render();
        if (!canceled) {
          if (element.current)
            setAnchors(
              previewAnchors(
                { pages: paper.pages, references: paper.references },
                number,
                indexTextLayer(currentLayer),
                element.current,
                view,
                original.height,
              ),
            );
          setView(view);
          setReady(true);
          setRenderVersion((value) => value + 1);
        }
      })
      .catch((err) => {
        if (!canceled) setError(errorMessage(err));
      });
    return () => {
      canceled = true;
      render?.cancel();
      currentLayer?.cancel();
      layer.current = null;
    };
  }, [
    doc,
    number,
    scale,
    rotation,
    near,
    attempt,
    paper.pages,
    paper.references,
  ]);
  useEffect(() => {
    if (
      !ready ||
      !normalizeSearch(query) ||
      !layer.current ||
      !element.current
    ) {
      requestAnimationFrame(() => setSearchRects([]));
      return;
    }
    const bounds = element.current.getBoundingClientRect();
    const rects: { rect: Rect; active: boolean }[] = [];
    const indexed = indexTextLayer(layer.current);
    const needle = normalizeSearch(query);
    const sourceText = indexed.text.toLocaleLowerCase();
    let found = sourceText.indexOf(needle);
    let localIndex = 0;
    const activeLocal = activeMatch?.ordinal ?? -1;
    while (found >= 0 && localIndex < 1000) {
      const range = indexed.range(found, needle.length);
      if (range)
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0)
            rects.push({
              rect: {
                x: rect.left - bounds.left,
                y: rect.top - bounds.top,
                width: rect.width,
                height: rect.height,
              },
              active: localIndex === activeLocal,
            });
        }
      found = sourceText.indexOf(needle, found + needle.length);
      localIndex++;
    }
    requestAnimationFrame(() => setSearchRects(rects));
  }, [
    ready,
    renderVersion,
    query,
    activeMatch,
    scale,
    rotation,
    number,
    paper.pages,
    near,
  ]);
  function capture() {
    const selection = window.getSelection();
    const el = element.current;
    const view = viewport.current;
    if (
      !selection ||
      !selection.rangeCount ||
      !el ||
      !view ||
      !selection.toString().trim()
    )
      return;
    const range = selection.getRangeAt(0);
    if (!text.current?.contains(range.commonAncestorContainer)) return;
    const value = selection.toString().trim().slice(0, 8000);
    const rects = selectionRects(range, el, view, base.height);
    onSelection({
      paperId: paper.id,
      text: value,
      context: paragraphContext(paper, number, value, rects),
      page: number,
      rects,
    });
  }
  return (
    <div
      ref={element}
      data-page-number={number}
      className="pdf-page"
      style={{ width: displayWidth, height: displayHeight }}
      onMouseUp={() => setTimeout(capture, 0)}
      onDoubleClick={() => setTimeout(capture, 0)}
      onTouchEnd={() => setTimeout(capture, 100)}
      onContextMenu={(e) => {
        if (window.getSelection()?.toString().trim()) {
          e.preventDefault();
          capture();
        }
      }}
    >
      <canvas ref={canvas} aria-label={`PDF page ${number}`} />
      <div ref={text} className="textLayer" />
      {!ready && !error && (
        <div className="page-loading">
          <Loading text={`Rendering page ${number}…`} />
        </div>
      )}
      {error && (
        <ErrorBox
          message={error}
          retry={() => {
            setError("");
            setAttempt((v) => v + 1);
          }}
        />
      )}
      <div className="pdf-overlays" aria-hidden="true">
        {view &&
          annotations.flatMap((a) =>
            a.rects.map((rect, i) => (
              <div
                className={`annotation-mark mark-${a.color}`}
                key={`${a.id}-${i}`}
                style={rectStyle(viewportRect(rect, view, base.height))}
              />
            )),
          )}
        {searchRects.map((match, i) => (
          <div
            key={i}
            className={`search-mark ${match.active ? "current-match" : ""}`}
            style={rectStyle(match.rect)}
          />
        ))}
        {view &&
          target?.rects.map((rect, i) => (
            <div
              className="citation-flash"
              key={`${target.nonce}-${i}`}
              style={rectStyle(viewportRect(rect, view, base.height))}
            />
          ))}
      </div>
      {ready &&
        view &&
        anchors.map((anchor, i) => {
          const bounds = viewportRect(anchor.rect, view, base.height);
          return (
            <div key={i} className="preview-anchor" style={rectStyle(bounds)}>
              {anchor.kind === "reference" ? (
                <ReferenceCard
                  paperId={paper.id}
                  reference={anchor.reference}
                  references={anchor.references}
                  onImport={onReferenceImport}
                  trigger={
                    <button
                      aria-label={`Preview reference ${anchor.label}`}
                      className="citation-trigger"
                    />
                  }
                />
              ) : (
                <HoverPopover
                  trigger={
                    <button
                      className="citation-trigger"
                      aria-label={`Preview ${anchor.label}`}
                    />
                  }
                >
                  <h3>{anchor.label}</h3>
                  <p className="prose">{anchor.context}</p>
                  <Thumbnail
                    doc={doc}
                    number={anchor.page}
                    previewWidth={280}
                  />
                  <Button onClick={() => onJump(anchor.page)}>
                    Go to original · page {anchor.page}
                  </Button>
                </HoverPopover>
              )}
            </div>
          );
        })}
    </div>
  );
}
function ReferenceCard({
  paperId,
  reference,
  references = [],
  onImport,
  trigger,
}: {
  paperId: string;
  reference: Reference;
  references?: Reference[];
  onImport: (source: string) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(reference.id);
  const selected =
    references.find((item) => item.id === selectedId) ?? reference;
  const [enriched, setResolved] = useState(reference);
  const resolved = enriched.id === selected.id ? enriched : selected;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || selected.id === "unresolved") return;
    const controller = new AbortController();
    Promise.resolve().then(() => setLoading(true));
    void api
      .reference(paperId, selected.id, controller.signal)
      .then(setResolved)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, paperId, selected.id]);
  const source = resolved.doi
    ? `https://doi.org/${resolved.doi}`
    : (safeLink(resolved.url) ?? safeLink(resolved.pdfUrl));
  const link = safeLink(resolved.url) ?? safeLink(resolved.pdfUrl);
  return (
    <HoverPopover onOpenChange={setOpen} trigger={trigger}>
      <div className="reference-preview" tabIndex={-1}>
        {references.length > 1 && (
          <label className="citation-group-label">
            Cited works
            <select
              aria-label="Choose a work in this citation"
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setImported(false);
                setError("");
              }}
            >
              {references.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}. {item.title || item.raw.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="muted">Reference {resolved.label}</span>
        <h3>{resolved.title || "Unresolved reference"}</h3>
        <p>
          {resolved.authors.join(", ")}
          {resolved.year ? ` (${resolved.year})` : ""}
        </p>
        <p className="muted">{resolved.venue}</p>
        {loading && <Loading text="Resolving metadata…" />}
        {error && (
          <p className="warning">
            Metadata lookup failed. Showing the stored reference. {error}
          </p>
        )}
        <p className="prose">{resolved.abstract || resolved.raw}</p>
        {resolved.pdfUrl ? (
          <PdfPreview paperId={paperId} referenceId={resolved.id} />
        ) : resolved.ingestedPaperId ? (
          <PdfPreview paperId={resolved.ingestedPaperId} />
        ) : (
          <p className="muted">
            {resolved.pdfUrl
              ? "A PDF link is available. Import this work to preview its pages securely."
              : "PDF preview unavailable. Review the reference metadata or source page."}
          </p>
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer">
            Open source page
          </a>
        )}
        <Button
          className="primary"
          disabled={!source || busy || imported || !!resolved.ingestedPaperId}
          onClick={(event) => {
            if (!source) return;
            event.currentTarget
              .closest<HTMLElement>(".reference-preview")
              ?.focus();
            setBusy(true);
            void onImport(source)
              .then(() => setImported(true))
              .catch((e) => setError(errorMessage(e)))
              .finally(() => setBusy(false));
          }}
        >
          {imported || resolved.ingestedPaperId
            ? "In your library"
            : busy
              ? "Importing…"
              : "Add to library"}
        </Button>
      </div>
    </HoverPopover>
  );
}
export function PdfPreview({
  paperId,
  referenceId,
}: {
  paperId: string;
  referenceId?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let canceled = false;
    let render: ReturnType<PDFPageProxy["render"]> | undefined;
    const task = getDocument({
      url: referenceId
        ? referencePreviewPath(paperId, referenceId)
        : pdfPath(paperId),
    });
    void task.promise
      .then(async (doc) => {
        const page = await doc.getPage(1);
        if (canceled || !canvas.current) return;
        const viewport = page.getViewport({
          scale: 280 / page.getViewport({ scale: 1 }).width,
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = page.render({ canvas: canvas.current, viewport });
        await render.promise;
      })
      .catch((e) => {
        if (!canceled) setError(errorMessage(e));
      });
    return () => {
      canceled = true;
      render?.cancel();
      void task.destroy();
    };
  }, [paperId, referenceId]);
  return error ? (
    <p className="warning">PDF preview unavailable: {error}</p>
  ) : (
    <canvas
      className="reference-pdf"
      ref={canvas}
      aria-label="First page of cited paper"
    />
  );
}
export function ReferencesPanel({
  paper,
  onImport,
  onJump,
}: {
  paper: Paper;
  onImport: (source: string) => Promise<void>;
  onJump: (citation: PassageCitation) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="references-panel">
      <label className="search-box">
        <Search size={16} />
        <input
          aria-label="Search references"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search authors or titles…"
        />
      </label>
      {paper.references
        .filter((r) =>
          `${r.title} ${r.authors.join(" ")} ${r.raw}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((r) => (
          <div className="reference-row" key={r.id}>
            <ReferenceCard
              paperId={paper.id}
              reference={r}
              onImport={onImport}
              trigger={
                <Button>
                  {r.label}. {r.title || r.raw}
                </Button>
              }
            />
            <Button
              onClick={() => {
                const page = paper.pages.find((p) =>
                  p.text.includes(`[${r.label.replace(/\D/g, "")}]`),
                );
                if (page)
                  onJump({
                    paperId: paper.id,
                    page: page.number,
                    chunkId: "",
                    quote: r.raw,
                    rects: page.spans
                      .filter((s) =>
                        s.text.includes(`[${r.label.replace(/\D/g, "")}]`),
                      )
                      .map((s) => s.rect),
                  });
              }}
            >
              Find passage
            </Button>
          </div>
        ))}
      {!paper.references.length && (
        <p className="muted">
          No bibliography entries were extracted for this paper.
        </p>
      )}
    </div>
  );
}
