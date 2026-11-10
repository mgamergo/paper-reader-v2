"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Columns2,
  Focus,
  Keyboard,
  Library as LibraryIcon,
  Menu,
  MoreHorizontal,
  PanelRight,
  Search,
  Sun,
  X,
} from "lucide-react";
import {
  defaultSettings,
  type Annotation,
  type Library,
  type Paper,
  type PassageCitation,
  type Settings,
} from "@/lib/domain";
import { api, errorMessage } from "@/lib/client";
import type { CommandId } from "@/lib/shortcuts";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { CommandCenter } from "./command-center";
import {
  ImportDialog,
  LibraryRail,
  LibraryView,
  MetadataDialog,
} from "./library";
import {
  AnnotationDialog,
  LearningPane,
  type LearningHandle,
  type LearningTab,
} from "./learning-pane";
import type { ReaderHandle, ReadingSelection } from "./pdf-reader";
import {
  Button,
  Empty,
  ErrorBox,
  IconButton,
  Loading,
  Modal,
} from "./ui/primitives";
const PdfReader = dynamic(
  () => import("./pdf-reader").then((module) => module.PdfReader),
  { ssr: false, loading: () => <Loading text="Loading PDF tools…" /> },
);
const References = dynamic(
  () => import("./pdf-reader").then((module) => module.ReferencesPanel),
  { ssr: false },
);
export default function Workspace({
  accountMenu,
}: {
  accountMenu?: ReactNode;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [learningTab, setLearningTab] = useState<LearningTab>("learn");
  const [chatScope, setChatScope] = useState("document");
  const [secondaryId, setSecondaryId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [allAnnotations, setAllAnnotations] = useState<
    Record<string, Annotation[]>
  >({});
  const [annotationError, setAnnotationError] = useState("");
  const [selection, setSelection] = useState<ReadingSelection | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [mobileMode, setMobileMode] = useState<"read" | "learn">("read");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const settingsQueue = useRef<Promise<void>>(Promise.resolve());
  const settingsVersion = useRef(0);
  const primary = useRef<ReaderHandle>(null);
  const secondary = useRef<ReaderHandle>(null);
  const learning = useRef<LearningHandle>(null);
  const pendingJump = useRef<PassageCitation | null>(null);
  const pages = useRef<Record<string, number>>({});
  const pendingProgress = useRef(
    new Map<string, { currentPage: number; progress: number }>(),
  );
  const saves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const selectionMenu = useRef<HTMLDivElement>(null);
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const settings = library?.settings ?? defaultSettings;
  const paper = library?.papers.find((p) => p.id === currentId);
  const second = library?.papers.find((p) => p.id === secondaryId);
  const activePaper = activeId === secondaryId && second ? second : paper;
  const annotations = activePaper ? (allAnnotations[activePaper.id] ?? []) : [];
  const refresh = useCallback(async () => {
    const value = await api.library();
    setLibrary(value);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .library(controller.signal)
      .then((value) => {
        setLibrary(value);
        setLoadError("");
        const stored = localStorage.getItem("paper-reader-v2.current");
        if (value.papers.some((p) => p.id === stored)) {
          setCurrentId(stored);
          setActiveId(stored);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  const refreshAnnotations = useCallback(async () => {
    const ids = [currentId, secondaryId].filter((id): id is string => !!id);
    const result = await Promise.all(
      ids.map(async (id) => ({ id, items: await api.annotations(id) })),
    );
    setAllAnnotations((previous) => ({
      ...previous,
      ...Object.fromEntries(result.map((item) => [item.id, item.items])),
    }));
    setAnnotationError("");
  }, [currentId, secondaryId]);
  useEffect(() => {
    const controller = new AbortController();
    const ids = [currentId, secondaryId].filter((id): id is string => !!id);
    void Promise.all(
      ids.map(async (id) => ({
        id,
        items: await api.annotations(id, controller.signal),
      })),
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setAllAnnotations((previous) => ({
            ...previous,
            ...Object.fromEntries(result.map((item) => [item.id, item.items])),
          }));
          setAnnotationError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setAnnotationError(errorMessage(e));
      });
    return () => controller.abort();
  }, [currentId, secondaryId]);
  useEffect(() => {
    const timers = saves.current;
    const pending = pendingProgress.current;
    function flushProgress() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      pending.forEach((patch, id) => {
        void api.paper(id, patch, true).catch(() => {});
      });
      pending.clear();
    }
    window.addEventListener("pagehide", flushProgress);
    return () => {
      window.removeEventListener("pagehide", flushProgress);
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);
  function openPaper(id: string) {
    setCurrentId(id);
    setActiveId(id);
    if (secondaryId === id) setSecondaryId(null);
    setSelection(null);
    setSelectionMenuOpen(false);
    setRailOpen(false);
    setMobileMode("read");
    localStorage.setItem("paper-reader-v2.current", id);
  }
  function updatePaper(next: Paper) {
    setLibrary((previous) =>
      previous
        ? {
            ...previous,
            papers: previous.papers.map((p) => (p.id === next.id ? next : p)),
          }
        : previous,
    );
  }
  async function patchSettings(patch: Partial<Settings>) {
    const version = ++settingsVersion.current;
    setLibrary((previous) =>
      previous
        ? { ...previous, settings: { ...previous.settings, ...patch } }
        : previous,
    );
    const pending = settingsQueue.current.then(() => api.settings(patch));
    settingsQueue.current = pending.then(
      () => {},
      () => {},
    );
    try {
      const confirmed = await pending;
      if (version === settingsVersion.current)
        setLibrary((previous) =>
          previous ? { ...previous, settings: confirmed } : previous,
        );
    } catch (error) {
      if (version === settingsVersion.current) await refresh();
      throw error;
    }
  }
  function changeSettings(patch: Partial<Settings>) {
    void patchSettings(patch).catch((e) => setError(errorMessage(e)));
  }
  function pageChanged(id: string, page: number) {
    pages.current[id] = page;
    pendingProgress.current.set(id, {
      currentPage: page,
      progress:
        page /
        Math.max(
          1,
          library?.papers.find((p) => p.id === id)?.pages.length ?? 1,
        ),
    });
    clearTimeout(saves.current.get(id));
    saves.current.set(
      id,
      setTimeout(() => {
        const total =
          library?.papers.find((p) => p.id === id)?.pages.length ?? 1;
        void api
          .paper(
            id,
            { currentPage: page, progress: page / Math.max(1, total) },
            true,
          )
          .then((next) => {
            setLibrary((previous) =>
              previous
                ? {
                    ...previous,
                    papers: previous.papers.map((p) =>
                      p.id === id
                        ? {
                            ...p,
                            currentPage: next.currentPage,
                            progress: next.progress,
                          }
                        : p,
                    ),
                  }
                : previous,
            );
          })
          .catch((e) =>
            setError(`Reading progress was not saved: ${errorMessage(e)}`),
          );
        saves.current.delete(id);
        pendingProgress.current.delete(id);
      }, 650),
    );
  }
  function reader() {
    return activeId === secondaryId && second
      ? secondary.current
      : primary.current;
  }
  function receivedSelection(value: ReadingSelection) {
    setSelection(value);
    setActiveId(value.paperId);
    setSelectionMenuOpen(true);
  }
  function showLearning(tab: LearningTab = "learn") {
    setMobileMode("learn");
    learning.current?.open(tab);
  }
  function annotate(kind: Annotation["kind"]) {
    if (!activePaper) return;
    if (kind !== "bookmark" && selection?.paperId !== activePaper.id) {
      setNotice("Select text in the PDF first.");
      return;
    }
    const selected = selection?.paperId === activePaper.id ? selection : null;
    setDraft({
      id: crypto.randomUUID(),
      paperId: activePaper.id,
      page:
        kind === "bookmark"
          ? (pages.current[activePaper.id] ?? activePaper.currentPage)
          : (selected?.page ?? 1),
      kind,
      text: kind === "bookmark" ? "" : (selected?.text ?? ""),
      comment: "",
      color: "yellow",
      rects: kind === "bookmark" ? [] : (selected?.rects ?? []),
      tags: [],
      createdAt: Date.now(),
    });
    setSelectionMenuOpen(false);
  }
  function jump(citation: PassageCitation) {
    if (!library?.papers.some((p) => p.id === citation.paperId)) {
      setError("This cited paper is not available in your library.");
      return;
    }
    setMobileMode("read");
    if (citation.paperId === secondaryId) {
      setActiveId(citation.paperId);
      secondary.current?.jump(citation);
    } else if (citation.paperId === currentId) {
      setActiveId(citation.paperId);
      primary.current?.jump(citation);
    } else {
      pendingJump.current = citation;
      openPaper(citation.paperId);
    }
  }
  function readyReader(id: string) {
    if (pendingJump.current?.paperId === id) {
      const citation = pendingJump.current;
      pendingJump.current = null;
      (id === secondaryId ? secondary : primary).current?.jump(citation);
    }
  }
  async function importReference(source: string) {
    const result = await api.import(source);
    await refresh();
    setNotice(`Added “${result.title}” to your library.`);
  }
  function run(command: CommandId) {
    switch (command) {
      case "palette":
        setPalette(true);
        break;
      case "shortcuts":
        setHelp(true);
        break;
      case "import":
        setImportOpen(true);
        break;
      case "focus":
        setFocus((v) => !v);
        break;
      case "dark":
        changeSettings({ theme: settings.theme === "dark" ? "light" : "dark" });
        break;
      case "sepia":
        changeSettings({
          theme: settings.theme === "sepia" ? "light" : "sepia",
        });
        break;
      case "mode":
        changeSettings({
          readingMode:
            settings.readingMode === "single" ? "continuous" : "single",
        });
        break;
      case "split":
        if (second) setSecondaryId(null);
        else setSplitOpen(true);
        break;
      case "chat":
        showLearning("chat");
        break;
      case "glossary":
        showLearning("glossary");
        break;
      case "review":
        showLearning("review");
        break;
      case "highlight":
        annotate("highlight");
        break;
      case "note":
        annotate("note");
        break;
      case "bookmark":
        annotate("bookmark");
        break;
      case "explain":
        if (!selection) {
          setNotice("Select a word or passage to explain it.");
          break;
        }
        showLearning();
        learning.current?.assist("explain");
        setSelectionMenuOpen(false);
        break;
      case "escape":
        setSelectionMenuOpen(false);
        setRailOpen(false);
        reader()?.run(command);
        break;
      default:
        reader()?.run(command);
    }
  }
  useShortcuts(settings.shortcuts, run);
  return (
    <div
      className={`workspace ${focus ? "focus-mode" : ""} mobile-${mobileMode}`}
    >
      <a href="#main-content" className="skip-link">
        Skip to reading workspace
      </a>
      {library && !focus && (
        <div className={`rail-container ${railOpen ? "rail-open" : ""}`}>
          <LibraryRail
            library={library}
            activeId={currentId ?? undefined}
            onOpen={openPaper}
            onImport={() => setImportOpen(true)}
            onLibrary={() => {
              setCurrentId(null);
              setRailOpen(false);
            }}
            onError={setError}
          />
          <IconButton
            label="Close library"
            className="close-rail"
            onClick={() => setRailOpen(false)}
          >
            <X size={18} />
          </IconButton>
        </div>
      )}
      <div className="main-workspace" id="main-content">
        <header className="workspace-header">
          <div className="header-left">
            <IconButton
              label="Open library navigation"
              className="mobile-menu"
              onClick={() => setRailOpen((v) => !v)}
            >
              <Menu size={20} />
            </IconButton>
            {paper ? (
              <>
                <IconButton
                  label="Back to library"
                  onClick={() => setCurrentId(null)}
                >
                  <ArrowLeft size={18} />
                </IconButton>
                <div className="document-title">
                  <h1>{paper.title}</h1>
                  <span>
                    {paper.authors.slice(0, 2).join(", ")}
                    {paper.authors.length > 2 ? " et al." : ""}
                    {paper.year ? ` (${paper.year})` : ""}
                  </span>
                </div>
              </>
            ) : (
              <span className="workspace-title">
                <LibraryIcon size={19} />
                Research workspace
              </span>
            )}
          </div>
          <div className="header-actions">
            {accountMenu}
            <IconButton
              label="Command palette"
              onClick={() => setPalette(true)}
            >
              <Search size={18} />
            </IconButton>
            <IconButton
              label="Keyboard shortcuts"
              onClick={() => setHelp(true)}
            >
              <Keyboard size={18} />
            </IconButton>
            <IconButton
              label="Toggle focus mode"
              aria-pressed={focus}
              onClick={() => setFocus((v) => !v)}
            >
              <Focus size={18} />
            </IconButton>
            {paper && (
              <IconButton
                label="Paper details"
                onClick={() => setMetadataOpen(true)}
              >
                <MoreHorizontal size={19} />
              </IconButton>
            )}
          </div>
        </header>
        {(notice || error) && (
          <div className="workspace-notice" role={error ? "alert" : "status"}>
            <span>{error || notice}</span>
            <IconButton
              label="Dismiss notification"
              onClick={() => {
                setNotice("");
                setError("");
              }}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
        {loadError ? (
          <ErrorBox message={loadError} retry={() => setRetry((v) => v + 1)} />
        ) : !library ? (
          <Loading text="Opening your research workspace…" />
        ) : !paper ? (
          <LibraryView
            library={library}
            onOpen={openPaper}
            onImport={() => setImportOpen(true)}
            refresh={refresh}
          />
        ) : (
          <>
            {paper.status !== "ready" && (
              <div className="workspace-notice" role="status">
                <span>
                  {paper.status === "indexing"
                    ? "This paper is being indexed. Answers may be unavailable until indexing finishes."
                    : paper.error || "This paper could not be indexed."}
                </span>
                <Button
                  disabled={reindexing}
                  onClick={() => {
                    setReindexing(true);
                    void api
                      .reindexPaper(paper.id)
                      .then(refresh)
                      .catch((error) => setError(errorMessage(error)))
                      .finally(() => setReindexing(false));
                  }}
                >
                  {reindexing ? "Reindexing…" : "Reindex paper"}
                </Button>
                <Button
                  onClick={() =>
                    void refresh().catch((error) =>
                      setError(errorMessage(error)),
                    )
                  }
                >
                  Refresh status
                </Button>
              </div>
            )}
            <div className="document-options">
              <div className="toolbar-group">
                <Button
                  onClick={() =>
                    changeSettings({
                      readingMode:
                        settings.readingMode === "continuous"
                          ? "single"
                          : "continuous",
                    })
                  }
                >
                  {settings.readingMode === "continuous"
                    ? "Continuous"
                    : "Single page"}
                </Button>
                <Button
                  aria-pressed={!!second}
                  onClick={() => {
                    if (second) setSecondaryId(null);
                    else setSplitOpen(true);
                  }}
                >
                  <Columns2 size={15} />
                  {second ? "Close split" : "Compare"}
                </Button>
                <Button onClick={() => annotate("bookmark")}>
                  <BookOpen size={15} />
                  Bookmark
                </Button>
              </div>
              <div className="toolbar-group">
                <label className="theme-label">
                  <Sun size={15} />
                  <select
                    aria-label="Workspace theme"
                    value={settings.theme}
                    onChange={(e) => {
                      const theme = e.target.value;
                      if (
                        theme === "light" ||
                        theme === "dark" ||
                        theme === "sepia"
                      )
                        changeSettings({ theme });
                    }}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="sepia">Sepia</option>
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={settings.pageAppearance}
                    onChange={(e) =>
                      changeSettings({ pageAppearance: e.target.checked })
                    }
                  />
                  Tint PDF pages
                </label>
              </div>
            </div>
            <div
              className="mobile-mode-switch"
              role="group"
              aria-label="Workspace mode"
            >
              <Button
                className={mobileMode === "read" ? "selected" : ""}
                aria-pressed={mobileMode === "read"}
                onClick={() => setMobileMode("read")}
              >
                <BookOpen size={16} />
                Read
              </Button>
              <Button
                className={mobileMode === "learn" ? "selected" : ""}
                aria-pressed={mobileMode === "learn"}
                onClick={() => setMobileMode("learn")}
              >
                <PanelRight size={16} />
                Learn & chat
              </Button>
            </div>
            <div className={`reading-desk ${second ? "is-split" : ""}`}>
              <div className="readers">
                {annotationError && (
                  <ErrorBox
                    message={`Could not load annotations: ${annotationError}`}
                    retry={() =>
                      void refreshAnnotations().catch((e) =>
                        setAnnotationError(errorMessage(e)),
                      )
                    }
                  />
                )}
                <div
                  className={`reader-slot ${activeId === paper.id ? "active-reader" : ""}`}
                >
                  <PdfReader
                    key={paper.id}
                    readerRef={primary}
                    paper={paper}
                    annotations={allAnnotations[paper.id] ?? []}
                    settings={settings}
                    onPage={(page) => pageChanged(paper.id, page)}
                    onSelection={receivedSelection}
                    onReferenceImport={importReference}
                    onActive={() => setActiveId(paper.id)}
                    onReady={() => readyReader(paper.id)}
                  />
                </div>
                {second && (
                  <div
                    className={`reader-slot ${activeId === second.id ? "active-reader" : ""}`}
                  >
                    <div className="split-title">
                      <span>{second.title}</span>
                      <IconButton
                        label="Close comparison paper"
                        onClick={() => {
                          setSecondaryId(null);
                          setActiveId(paper.id);
                        }}
                      >
                        <X size={16} />
                      </IconButton>
                    </div>
                    <PdfReader
                      key={second.id}
                      readerRef={secondary}
                      compact
                      paper={second}
                      annotations={allAnnotations[second.id] ?? []}
                      settings={settings}
                      onPage={(page) => pageChanged(second.id, page)}
                      onSelection={receivedSelection}
                      onReferenceImport={importReference}
                      onActive={() => setActiveId(second.id)}
                      onReady={() => readyReader(second.id)}
                    />
                  </div>
                )}
                {selectionMenuOpen && selection && (
                  <div
                    className="selection-menu"
                    ref={selectionMenu}
                    aria-label="Selected text actions"
                  >
                    <span>
                      {selection.text.slice(0, 70)}
                      {selection.text.length > 70 ? "…" : ""}
                    </span>
                    <div>
                      {(
                        [
                          ["explain", "Explain"],
                          ["define", "Define"],
                          ["summarize", "Summarize section"],
                          ["translate", "Translate"],
                          ["related", "Find related papers"],
                        ] satisfies [
                          (
                            | "explain"
                            | "define"
                            | "summarize"
                            | "translate"
                            | "related"
                          ),
                          string,
                        ][]
                      ).map(([action, label]) => (
                        <Button
                          key={action}
                          onClick={() => {
                            showLearning();
                            learning.current?.assist(action);
                            setSelectionMenuOpen(false);
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                      <Button onClick={() => annotate("highlight")}>
                        Highlight
                      </Button>
                      <Button onClick={() => annotate("note")}>Note</Button>
                      <IconButton
                        label="Close selection actions"
                        onClick={() => setSelectionMenuOpen(false)}
                      >
                        <X size={15} />
                      </IconButton>
                    </div>
                  </div>
                )}
              </div>
              {activePaper && (
                <LearningPane
                  key={activePaper.id}
                  ref={learning}
                  paper={activePaper}
                  collections={library.collections}
                  tab={learningTab}
                  onTabChange={setLearningTab}
                  scope={
                    library.collections.some(
                      (collection) => collection.id === chatScope,
                    )
                      ? chatScope
                      : "document"
                  }
                  onScopeChange={setChatScope}
                  settings={settings}
                  glossary={library.glossary}
                  annotations={annotations}
                  selection={selection}
                  onSettings={changeSettings}
                  onJump={jump}
                  onGlossary={refresh}
                  onAnnotations={refreshAnnotations}
                  onError={setError}
                  renderReferences={
                    <References
                      paper={activePaper}
                      onImport={importReference}
                      onJump={jump}
                    />
                  }
                />
              )}
            </div>
          </>
        )}
      </div>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={async (next) => {
          await refresh();
          openPaper(next.id);
        }}
      />
      {paper && metadataOpen && (
        <MetadataDialog
          key={paper.id}
          paper={paper}
          collections={library?.collections ?? []}
          open={metadataOpen}
          onOpenChange={setMetadataOpen}
          onSave={updatePaper}
          onDelete={async () => {
            clearTimeout(saves.current.get(paper.id));
            saves.current.delete(paper.id);
            pendingProgress.current.delete(paper.id);
            await api.deletePaper(paper.id);
            setMetadataOpen(false);
            setCurrentId(null);
            if (secondaryId === paper.id) setSecondaryId(null);
            await refresh();
          }}
        />
      )}
      <CommandCenter
        palette={palette}
        help={help}
        onPalette={setPalette}
        onHelp={setHelp}
        overrides={settings.shortcuts}
        onRun={run}
        onRemap={async (overrides) => patchSettings({ shortcuts: overrides })}
      />
      <Modal
        open={splitOpen}
        onOpenChange={setSplitOpen}
        title="Compare two papers"
        description="Choose a second paper. Each reader keeps its own page and zoom."
      >
        <div className="command-list">
          {library?.papers
            .filter((p) => p.id !== currentId)
            .map((p) => (
              <Button
                key={p.id}
                onClick={() => {
                  setSecondaryId(p.id);
                  setSplitOpen(false);
                }}
              >
                {p.title}
              </Button>
            ))}
          {(library?.papers.length ?? 0) < 2 && (
            <Empty title="Add another paper">
              <p>Import a second paper to compare methods and evidence.</p>
              <Button
                onClick={() => {
                  setSplitOpen(false);
                  setImportOpen(true);
                }}
              >
                Import paper
              </Button>
            </Empty>
          )}
        </div>
      </Modal>
      {draft && (
        <AnnotationDialog
          key={draft.id}
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            await refreshAnnotations();
            setNotice("Annotation saved.");
          }}
        />
      )}
    </div>
  );
}
