"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Languages,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  Annotation,
  AssistRequest,
  ChatMessage,
  Collection,
  GlossaryEntry,
  Paper,
  PassageCitation,
  RagAnswer,
  Settings,
} from "@/lib/domain";
import { api, errorMessage } from "@/lib/client";
import { annotationsMarkdown, downloadText, toBibtex } from "@/lib/export";
import type { ReadingSelection } from "./pdf-reader";
import {
  Button,
  Empty,
  ErrorBox,
  IconButton,
  Loading,
  Modal,
} from "./ui/primitives";
export type LearningTab =
  "learn" | "chat" | "notes" | "glossary" | "review" | "references";
export type LearningHandle = {
  open: (tab: LearningTab) => void;
  assist: (action: AssistRequest["action"], query?: string) => void;
};
const languages = [
  "Hindi",
  "Telugu",
  "Marathi",
  "English",
  "Bengali",
  "Tamil",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Urdu",
  "Spanish",
  "French",
  "Chinese",
  "Japanese",
  "Arabic",
  "Portuguese",
];
export function LearningPane({
  paper,
  collections,
  settings,
  glossary,
  annotations,
  selection,
  onSettings,
  onJump,
  onGlossary,
  onAnnotations,
  onError,
  renderReferences,
  tab,
  onTabChange: setTab,
  scope,
  onScopeChange: setScope,
  ref,
}: {
  paper: Paper;
  collections: Collection[];
  settings: Settings;
  glossary: GlossaryEntry[];
  annotations: Annotation[];
  selection: ReadingSelection | null;
  onSettings: (patch: Partial<Settings>) => void;
  onJump: (citation: PassageCitation) => void;
  onGlossary: () => Promise<void>;
  onAnnotations: () => Promise<void>;
  onError: (error: string) => void;
  renderReferences: React.ReactNode;
  tab: LearningTab;
  onTabChange: (tab: LearningTab) => void;
  scope: string;
  onScopeChange: (scope: string) => void;
  ref?: Ref<LearningHandle>;
}) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [answerLanguage, setAnswerLanguage] = useState(settings.language);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [lastRequest, setLastRequest] = useState<AssistRequest | null>(null);
  const [kind, setKind] = useState<
    "" | "text" | "figure" | "table" | "equation" | "references"
  >("");
  const [section, setSection] = useState("");
  const [expand, setExpand] = useState(false);
  const [overrideLanguage, setOverrideLanguage] = useState(settings.language);
  const [saved, setSaved] = useState("");
  const [refreshHistory, setRefreshHistory] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const requestLock = useRef(false);
  const requestAnchor = useRef<ReadingSelection | null>(null);
  const [answerAnchor, setAnswerAnchor] = useState<ReadingSelection | null>(
    null,
  );
  const historyKey = scope === "document" ? paper.id : `collection:${scope}`;
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setHistoryLoading(true);
      setHistoryError("");
    });
    void api
      .chat(historyKey, controller.signal)
      .then(setHistory)
      .catch((e) => {
        if (!controller.signal.aborted) setHistoryError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [historyKey, refreshHistory]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [history, answer, busy]);
  async function assist(
    action: AssistRequest["action"],
    query?: string,
    language?: string,
    replay?: AssistRequest,
  ) {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    setError("");
    setSaved("");
    const currentSelection = selection?.paperId === paper.id ? selection : null;
    if (!replay) requestAnchor.current = currentSelection;
    const fallback =
      action === "summarize"
        ? "Summarize this paper: overview, contributions, methods, limitations and key glossary."
        : action === "related"
          ? "Find related papers cited by this paper. Only name works supported by the bibliography."
          : `Explain the ${action === "figure" ? "figure using its actual caption and section evidence; state visual limitations" : action === "equation" ? "equation using its actual section evidence" : "selected passage in this paper"}.`;
    const body: AssistRequest = replay ?? {
      ...(action === "chat" && scope !== "document"
        ? { collectionId: scope }
        : { paperId: paper.id }),
      query: (query || currentSelection?.text || input || fallback).slice(
        0,
        4000,
      ),
      action,
      language: language ?? settings.language,
      difficulty: settings.difficulty,
      filters: {
        ...(kind ? { kind } : {}),
        ...(section ? { section } : {}),
        expandCitations: expand,
      },
      ...(currentSelection
        ? {
            selection: {
              text: currentSelection.text,
              context: currentSelection.context,
              page: currentSelection.page,
              rects: currentSelection.rects.slice(0, 200),
            },
          }
        : {}),
    };
    setLastRequest(body);
    if (action === "chat") setTab("chat");
    else setTab("learn");
    try {
      const result = await api.assist(body);
      setAnswer(result);
      setAnswerAnchor(requestAnchor.current);
      setOverrideLanguage(body.language);
      setAnswerLanguage(body.language);
      setInput("");
      setRefreshHistory((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }
  useImperativeHandle(ref, () => ({
    open(next) {
      setTab(next);
      if (next === "chat") setTimeout(() => composer.current?.focus(), 0);
    },
    assist(action, query) {
      void assist(action, query);
    },
  }));
  async function saveTerm({
    term,
    definition,
    translation,
    source,
    language: targetLanguage = answerLanguage,
  }: Pick<GlossaryEntry, "term" | "definition" | "translation"> & {
    source?: PassageCitation;
    language?: string;
  }) {
    setSaved("");
    try {
      const now = Date.now();
      await api.glossary({
        id: crypto.randomUUID(),
        paperId: source?.paperId ?? paper.id,
        term,
        definition,
        translation,
        language: targetLanguage,
        context:
          source?.quote ??
          lastRequest?.selection?.context ??
          lastRequest?.query ??
          paper.title,
        dueAt: now,
        interval: 0,
        repetitions: 0,
        createdAt: now,
      });
      await onGlossary();
      setSaved(`Saved “${term}” to your glossary.`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function saveExplanation() {
    if (!answer) return;
    setError("");
    try {
      await api.saveAnnotation({
        id: crypto.randomUUID(),
        paperId: paper.id,
        page: lastRequest?.selection?.page ?? paper.currentPage,
        kind: "note",
        text: lastRequest?.selection?.text ?? "Paper explanation",
        comment:
          answer.sentences.map((sentence) => sentence.text).join("\n\n") +
          (answer.translation ? "\n\n" + answer.translation : ""),
        color: "blue",
        rects: answerAnchor?.paperId === paper.id ? answerAnchor.rects : [],
        tags: ["explanation"],
        createdAt: Date.now(),
      });
      await onAnnotations();
      setSaved("Explanation saved to your notes.");
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  const tabs: { id: LearningTab; label: string }[] = [
    { id: "learn", label: "Learn" },
    { id: "chat", label: "Chat" },
    { id: "notes", label: "Notes" },
    { id: "glossary", label: "Glossary" },
    { id: "review", label: "Review" },
    { id: "references", label: "References" },
  ];
  return (
    <aside className="learning-pane" aria-label="Learning workspace">
      <header className="learning-heading">
        <div className="learning-brand">
          <Sparkles size={20} />
          <h2>Understand the paper</h2>
        </div>
        <p>Keep the science. Make the language yours.</p>
      </header>
      <div className="learning-tabs" role="tablist" aria-label="Learning tools">
        {tabs.map((item, i) => (
          <button
            key={item.id}
            id={`learning-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`learning-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next =
                  tabs[
                    (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                      tabs.length
                  ];
                if (next) {
                  setTab(next.id);
                  document.getElementById(`learning-tab-${next.id}`)?.focus();
                }
              }
            }}
          >
            {item.label}
            {item.id === "notes" && annotations.length > 0 && (
              <span>{annotations.length}</span>
            )}
          </button>
        ))}
      </div>
      <div
        className="learning-content"
        role="tabpanel"
        id={`learning-panel-${tab}`}
        aria-labelledby={`learning-tab-${tab}`}
      >
        {(tab === "learn" || tab === "chat") && (
          <>
            <div className="learning-preferences">
              <label>
                <Languages size={15} />
                <span className="sr-only">Default explanation language</span>
                <select
                  value={settings.language}
                  onChange={(e) => onSettings({ language: e.target.value })}
                >
                  {languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="difficulty">
                Reading level{" "}
                <input
                  aria-label="Explanation difficulty"
                  type="range"
                  min={1}
                  max={5}
                  value={settings.difficulty}
                  onChange={(e) =>
                    onSettings({ difficulty: Number(e.target.value) })
                  }
                />
                <span>
                  {settings.difficulty === 1
                    ? "Simple"
                    : settings.difficulty === 5
                      ? "Expert"
                      : `Level ${settings.difficulty}`}
                </span>
              </label>
            </div>
            {tab === "learn" && (
              <>
                {selection?.paperId === paper.id ? (
                  <div className="selected-passage">
                    <div>
                      <strong>Selected · page {selection.page}</strong>
                      <span>{selection.text.split(/\s+/).length} words</span>
                    </div>
                    <blockquote>{selection.text}</blockquote>
                    <div className="selection-actions">
                      {(
                        [
                          ["explain", "Explain"],
                          ["define", "Define"],
                          ["translate", "Translate"],
                          ["simplify", "Simplify"],
                          ["summarize", "Summarize section"],
                          ["related", "Find related papers"],
                          ["equation", "Explain equation"],
                          ["figure", "Explain figure"],
                        ] satisfies [AssistRequest["action"], string][]
                      ).map(([action, label]) => (
                        <Button
                          disabled={busy}
                          key={action}
                          onClick={() => void assist(action)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="learning-welcome">
                    <BookOpen size={30} />
                    <h3>Read with understanding.</h3>
                    <p className="prose">
                      Select a word or passage in the PDF. Explore its meaning
                      in context, then keep it in your own glossary.
                    </p>
                    <Button
                      className="primary"
                      disabled={busy}
                      onClick={() => void assist("summarize")}
                    >
                      Get a paper overview
                    </Button>
                  </div>
                )}
                <div className="quick-actions">
                  {[
                    "Contributions",
                    "Methods",
                    "Limitations",
                    "Key glossary",
                  ].map((topic) => (
                    <Button
                      key={topic}
                      disabled={busy}
                      onClick={() =>
                        void assist(
                          "summarize",
                          `Explain this paper's ${topic.toLowerCase()} with cited evidence.`,
                        )
                      }
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
                {answer && (
                  <div className="answer-toolbar">
                    <label>
                      Answer language
                      <select
                        aria-label="Override answer language"
                        value={overrideLanguage}
                        onChange={(e) => setOverrideLanguage(e.target.value)}
                      >
                        {languages.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (lastRequest)
                          void assist(
                            lastRequest.action,
                            lastRequest.query,
                            overrideLanguage,
                            { ...lastRequest, language: overrideLanguage },
                          );
                      }}
                    >
                      Regenerate
                    </Button>
                  </div>
                )}
                {answer && (
                  <Answer
                    answer={answer}
                    language={answerLanguage}
                    onJump={onJump}
                    onDefine={(term) =>
                      void assist(
                        "define",
                        `Define ${term} in the context of this paper.`,
                      )
                    }
                    onSave={(term) =>
                      void saveTerm({
                        term: term.term,
                        definition: term.definition,
                        translation: term.translation ?? "",
                        language: answer?.language ?? answerLanguage,
                        source: term.citations?.[0],
                      })
                    }
                  />
                )}
                {answer && !answer.refused && (
                  <Button onClick={() => void saveExplanation()}>
                    Save explanation to notes
                  </Button>
                )}
              </>
            )}
            {tab === "chat" && (
              <>
                <label className="scope-select">
                  Ask across
                  <select
                    aria-label="Chat scope"
                    value={scope}
                    disabled={busy}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="document">This paper</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        Collection: {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {historyLoading && <Loading text="Loading conversation…" />}
                {historyError && (
                  <ErrorBox
                    message={`Conversation history could not be loaded: ${historyError}`}
                    retry={() => setRefreshHistory((value) => value + 1)}
                  />
                )}
                {!history.length && !historyLoading && (
                  <Empty title="Ask a focused question">
                    <p>Answers cite passages you can check in the PDF.</p>
                    <div className="quick-actions">
                      {[
                        "What problem does this paper solve?",
                        "What evidence supports the main claim?",
                        "What are the limitations?",
                      ].map((q) => (
                        <Button
                          key={q}
                          disabled={busy}
                          onClick={() => void assist("chat", q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </Empty>
                )}
                {history.map((message) => (
                  <article
                    className={`chat-message ${message.role}`}
                    key={message.id}
                  >
                    <strong>
                      {message.role === "user" ? "You" : "Reading assistant"}
                    </strong>
                    {message.answer ? (
                      <Answer
                        answer={message.answer}
                        language="Translation"
                        onJump={onJump}
                        onDefine={(term) => void assist("define", term)}
                        onSave={(term) =>
                          void saveTerm({
                            term: term.term,
                            definition: term.definition,
                            translation: term.translation ?? "",
                            language:
                              message.answer?.language ?? answerLanguage,
                            source: term.citations?.[0],
                          })
                        }
                      />
                    ) : (
                      <p className="prose">{message.text}</p>
                    )}
                  </article>
                ))}
              </>
            )}
            {busy && (
              <Loading text="Finding evidence and preparing an explanation…" />
            )}
            {error && (
              <ErrorBox
                message={error}
                retry={() => {
                  if (lastRequest)
                    void assist(
                      lastRequest.action,
                      lastRequest.query,
                      lastRequest.language,
                      lastRequest,
                    );
                  else setRefreshHistory((v) => v + 1);
                }}
              />
            )}
            {saved && (
              <p role="status" className="success">
                <Check size={15} />
                {saved}
              </p>
            )}
            <details className="retrieval-controls">
              <summary>
                Evidence scope <ChevronDown size={14} />
              </summary>
              <label>
                Section
                <input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="All sections"
                />
              </label>
              <label>
                Passage type
                <select
                  aria-label="Passage type"
                  value={kind}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === "" ||
                      value === "text" ||
                      value === "figure" ||
                      value === "table" ||
                      value === "equation" ||
                      value === "references"
                    )
                      setKind(value);
                  }}
                >
                  <option value="">All passage types</option>
                  {["text", "figure", "table", "equation", "references"].map(
                    (k) => (
                      <option key={k}>{k}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={expand}
                  onChange={(e) => setExpand(e.target.checked)}
                />
                Include cited papers already in my library
              </label>
            </details>
            <div ref={end} />
          </>
        )}
        {tab === "notes" && (
          <AnnotationsPanel
            paper={paper}
            annotations={annotations}
            refresh={onAnnotations}
            onJump={onJump}
            onError={onError}
          />
        )}
        {tab === "glossary" && (
          <GlossaryPanel
            entries={glossary}
            refresh={onGlossary}
            onError={onError}
          />
        )}
        {tab === "review" && (
          <Flashcards
            entries={glossary}
            refresh={onGlossary}
            onError={onError}
          />
        )}
        {tab === "references" && renderReferences}
      </div>
      {(tab === "learn" || tab === "chat") && (
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) void assist("chat", input.trim());
          }}
        >
          <label className="sr-only" htmlFor="question">
            Ask a follow-up question
          </label>
          <textarea
            ref={composer}
            id="question"
            rows={2}
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this paper…"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (input.trim() && !busy) void assist("chat", input.trim());
              }
            }}
          />
          <IconButton
            label="Send question"
            className="primary"
            type="submit"
            disabled={busy || !input.trim()}
          >
            <ArrowUp size={18} />
          </IconButton>
          <span>Enter to send · Shift+Enter for a new line</span>
        </form>
      )}
    </aside>
  );
}
function Answer({
  answer,
  language,
  onJump,
  onDefine,
  onSave,
}: {
  answer: RagAnswer;
  language: string;
  onJump: (citation: PassageCitation) => void;
  onDefine: (term: string) => void;
  onSave: (term: RagAnswer["terms"][number]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const mock = /mock|offline|deterministic|synthetic/i.test(answer.provider);
  const answerLanguage = answer.language ?? language;
  const nativeSentences = answer.sentences.filter(
    (sentence) => sentence.translation,
  );
  const nativeLang =
    answerLanguage === "Hindi"
      ? "hi"
      : answerLanguage === "Telugu"
        ? "te"
        : answerLanguage === "Marathi"
          ? "mr"
          : undefined;
  function linkedTerms(text: string) {
    const terms = answer.terms
      .filter((t) => t.term.length > 0)
      .sort((a, b) => b.term.length - a.term.length);
    if (!terms.length) return text;
    const escaped = terms.map((t) =>
      t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
    return parts.map((part, i) =>
      terms.some((term) => term.term.toLowerCase() === part.toLowerCase()) ? (
        <button className="term-link" key={i} onClick={() => onDefine(part)}>
          {part}
        </button>
      ) : (
        part
      ),
    );
  }
  return (
    <article className={`answer ${answer.refused ? "answer-refused" : ""}`}>
      <div className="provider-label">
        <span>{answer.provider}</span>
        <IconButton
          label="Copy explanation"
          onClick={() => {
            void navigator.clipboard
              .writeText(
                answer.sentences.map((s) => s.text).join("\n") +
                  (answer.translation ? `\n\n${answer.translation}` : ""),
              )
              .then(() => setCopied(true))
              .catch((e) => setError(errorMessage(e)));
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </IconButton>
      </div>
      {mock && (
        <p className="provider-notice">
          Offline provider: demonstrates evidence retrieval. Language quality
          and real-model reasoning are not verified.
        </p>
      )}
      {answer.refused && (
        <strong className="refusal">
          The available paper evidence does not support this answer.
        </strong>
      )}
      <div className="bilingual-block">
        <h3>English explanation</h3>
        {answer.sentences.map((sentence, i) => (
          <p className="prose" key={i}>
            {linkedTerms(sentence.text)}{" "}
            {sentence.citations.map((citation, j) => (
              <button
                className="source-citation"
                key={`${citation.chunkId}-${j}`}
                aria-label={`Read source on page ${citation.page}: ${citation.quote.slice(0, 90)}`}
                title={citation.quote}
                onClick={() => onJump(citation)}
              >
                p. {citation.page}
              </button>
            ))}
          </p>
        ))}
      </div>
      {(answerLanguage.toLowerCase() !== "english" || answer.translation) && (
        <div className="bilingual-block translation">
          <h3>
            <Languages size={16} />
            {answerLanguage}
          </h3>
          {nativeSentences.length ? (
            nativeSentences.map((sentence, index) => (
              <p className="prose" key={index} lang={nativeLang}>
                {linkedTerms(sentence.translation ?? "")}{" "}
                {sentence.citations.map((citation, number) => (
                  <button
                    className="source-citation"
                    key={`${citation.chunkId}-${number}`}
                    aria-label={`Read source for ${answerLanguage} sentence on page ${citation.page}: ${citation.quote.slice(0, 90)}`}
                    title={citation.quote}
                    onClick={() => onJump(citation)}
                  >
                    p. {citation.page}
                  </button>
                ))}
              </p>
            ))
          ) : answer.translation ? (
            <p className="prose" lang={nativeLang}>
              {answer.translation}
            </p>
          ) : (
            <p className="muted">
              A translation was not returned by this provider. No translated
              text has been generated.
            </p>
          )}
        </div>
      )}
      {answer.terms.length > 0 && (
        <div className="answer-terms">
          <h4>Keep the vocabulary</h4>
          {answer.terms.map((term) => (
            <div className="term-row" key={term.term}>
              <div>
                <button
                  className="term-link"
                  onClick={() => onDefine(term.term)}
                >
                  {term.term}
                </button>
                <p>
                  {term.definition}{" "}
                  {term.citations?.map((citation, index) => (
                    <button
                      className="source-citation"
                      key={`${citation.chunkId}-${index}`}
                      aria-label={`Read definition source for ${term.term} on page ${citation.page}`}
                      title={citation.quote}
                      onClick={() => onJump(citation)}
                    >
                      p. {citation.page}
                    </button>
                  ))}
                </p>
                {term.translation && (
                  <p className="prose" lang={nativeLang}>
                    {term.translation}{" "}
                    {term.citations?.map((citation, index) => (
                      <button
                        className="source-citation"
                        key={`${citation.chunkId}-${index}`}
                        aria-label={`Read translated definition source for ${term.term} on page ${citation.page}`}
                        title={citation.quote}
                        onClick={() => onJump(citation)}
                      >
                        p. {citation.page}
                      </button>
                    ))}
                  </p>
                )}
              </div>
              <IconButton
                label={`Save ${term.term} to glossary`}
                onClick={() => onSave(term)}
              >
                <Plus size={16} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <details className="debug-panel">
        <summary>
          Retrieval details{" "}
          <span>
            {answer.debug.hits.length} passages ·{" "}
            {Math.round(answer.debug.elapsedMs)} ms
          </span>
        </summary>
        <h4>Queries</h4>
        <ul>
          {answer.debug.queries.map((query, i) => (
            <li key={i}>{query}</li>
          ))}
        </ul>
        <h4>HyDE</h4>
        <p>{answer.debug.hyde || "No hypothetical document used."}</p>
        <h4>Ranking stages</h4>
        <ol>
          {answer.debug.stages.map((stage, i) => (
            <li key={i}>{stage}</li>
          ))}
        </ol>
        <h4>Filters</h4>
        <pre>{JSON.stringify(answer.debug.filters, null, 2)}</pre>
        {answer.debug.hits.map((hit, i) => (
          <details key={`${hit.chunk.id}-${i}`}>
            <summary>
              #{i + 1} · page {hit.chunk.page} · {hit.score.toFixed(4)}
            </summary>
            <p>{hit.chunk.sectionPath.join(" / ")}</p>
            <p className="prose">{hit.chunk.text}</p>
            <p>
              <strong>Context:</strong> {hit.chunk.context}
            </p>
            <p>
              <strong>Parent:</strong> {hit.chunk.parentText}
            </p>
            <table>
              <caption>Scores and ranks</caption>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Score</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  new Set([
                    ...Object.keys(hit.stages),
                    ...Object.keys(hit.ranks),
                  ]),
                ).map((stage) => (
                  <tr key={stage}>
                    <td>{stage}</td>
                    <td>{hit.stages[stage]?.toFixed(4) ?? "—"}</td>
                    <td>{hit.ranks[stage] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              onClick={() =>
                onJump({
                  paperId: hit.chunk.paperId,
                  chunkId: hit.chunk.id,
                  page: hit.chunk.page,
                  quote: hit.chunk.text,
                  rects: hit.chunk.rects,
                })
              }
            >
              Read passage
            </Button>
          </details>
        ))}
      </details>
    </article>
  );
}
export function AnnotationDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Annotation | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(draft);
  const [tags, setTags] = useState(draft?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!value) return null;
  async function save() {
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      await api.saveAnnotation({
        ...value,
        tags: [
          ...new Set(
            tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!draft}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={value.kind === "bookmark" ? "Bookmark page" : "Save annotation"}
      description={`Page ${value.page}. Highlights keep their original PDF coordinates.`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {value.text && <blockquote className="prose">{value.text}</blockquote>}
        <label>
          Type
          <select
            value={value.kind}
            onChange={(e) => {
              const kind = e.target.value;
              if (
                kind === "highlight" ||
                kind === "note" ||
                kind === "bookmark"
              )
                setValue({ ...value, kind });
            }}
          >
            <option value="highlight">Highlight</option>
            <option value="note">Note</option>
            <option value="bookmark">Bookmark</option>
          </select>
        </label>
        <fieldset className="color-options">
          <legend>Highlight color</legend>
          {(
            [
              "yellow",
              "green",
              "blue",
              "pink",
              "purple",
            ] satisfies Annotation["color"][]
          ).map((color) => (
            <label className={`color-option mark-${color}`} key={color}>
              <input
                type="radio"
                name="color"
                checked={value.color === color}
                onChange={() => setValue({ ...value, color })}
              />
              <span>{color}</span>
            </label>
          ))}
        </fieldset>
        <label>
          Note or comment
          <textarea
            rows={4}
            value={value.comment}
            onChange={(e) => setValue({ ...value, comment: e.target.value })}
          />
        </label>
        <label>
          Tags (comma separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        {error && <ErrorBox message={error} />}
        <Button className="primary" type="submit" disabled={busy}>
          Save annotation
        </Button>
      </form>
    </Modal>
  );
}
function AnnotationsPanel({
  paper,
  annotations,
  refresh,
  onJump,
  onError,
}: {
  paper: Paper;
  annotations: Annotation[];
  refresh: () => Promise<void>;
  onJump: (citation: PassageCitation) => void;
  onError: (error: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Annotation | null>(null);
  const [busy, setBusy] = useState("");
  return (
    <div className="annotations-panel">
      <div className="export-buttons">
        <Button
          onClick={() =>
            downloadText(
              annotationsMarkdown(paper, annotations),
              "annotations.md",
              "text/markdown",
            )
          }
        >
          Export Markdown
        </Button>
        <Button
          onClick={() =>
            downloadText(toBibtex(paper), "paper.bib", "application/x-bibtex")
          }
        >
          Export BibTeX
        </Button>
      </div>
      <label className="search-box">
        <Search size={16} />
        <input
          placeholder="Search notes or tags…"
          aria-label="Search annotations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {annotations
        .filter((a) =>
          `${a.text} ${a.comment} ${a.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((a) => (
          <article key={a.id} className={`annotation-card border-${a.color}`}>
            <button
              className="annotation-location"
              onClick={() =>
                onJump({
                  paperId: a.paperId,
                  chunkId: a.id,
                  page: a.page,
                  quote: a.text,
                  rects: a.rects,
                })
              }
            >
              {a.kind} · page {a.page}
            </button>
            {a.text && <blockquote className="prose">{a.text}</blockquote>}
            <p className="prose">{a.comment}</p>
            <div className="tags">
              {a.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <div className="form-row">
              <Button onClick={() => setEditing(a)}>Edit</Button>
              <Button
                className="danger"
                disabled={busy === a.id}
                onClick={() => {
                  setBusy(a.id);
                  void api
                    .deleteAnnotation(a.id)
                    .then(refresh)
                    .catch((e) => onError(errorMessage(e)))
                    .finally(() => setBusy(""));
                }}
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
      {!annotations.length && (
        <Empty title="Your notes belong here">
          <p>
            Select PDF text to highlight it or add a note. Bookmark pages to
            return to them.
          </p>
        </Empty>
      )}
      {editing && (
        <AnnotationDialog
          key={editing.id}
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
function GlossaryPanel({
  entries,
  refresh,
  onError,
}: {
  entries: GlossaryEntry[];
  refresh: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<GlossaryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.updateGlossary(editing.id, {
        term: editing.term,
        definition: editing.definition,
        translation: editing.translation,
        context: editing.context,
        language: editing.language,
      });
      await refresh();
      setEditing(null);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h3>Your contextual glossary</h3>
      <label className="search-box">
        <Search size={16} />
        <input
          aria-label="Search glossary"
          placeholder="Find a term…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {entries
        .filter((entry) =>
          `${entry.term} ${entry.definition} ${entry.translation}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((entry) => (
          <article className="glossary-card" key={entry.id}>
            <h4>{entry.term}</h4>
            <p className="prose">{entry.definition}</p>
            {entry.translation && (
              <p className="prose translation-text">{entry.translation}</p>
            )}
            <details>
              <summary>Original context</summary>
              <blockquote className="prose">{entry.context}</blockquote>
            </details>
            <div className="form-row">
              <Button onClick={() => setEditing(entry)}>Edit</Button>
              <IconButton
                label={`Delete glossary term ${entry.term}`}
                onClick={() =>
                  void api
                    .deleteGlossary(entry.id)
                    .then(refresh)
                    .catch((e) => onError(errorMessage(e)))
                }
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </article>
        ))}
      {!entries.length && (
        <Empty title="Build your research vocabulary">
          <p>
            Save a term from an explanation. Its definition and paper context
            stay together.
          </p>
        </Empty>
      )}
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Edit glossary term"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {editing && (
            <>
              <label>
                Term
                <input
                  required
                  value={editing.term}
                  onChange={(e) =>
                    setEditing({ ...editing, term: e.target.value })
                  }
                />
              </label>
              <label>
                Definition
                <textarea
                  required
                  rows={4}
                  value={editing.definition}
                  onChange={(e) =>
                    setEditing({ ...editing, definition: e.target.value })
                  }
                />
              </label>
              <label>
                Translation
                <textarea
                  rows={3}
                  value={editing.translation}
                  onChange={(e) =>
                    setEditing({ ...editing, translation: e.target.value })
                  }
                />
              </label>
              <label>
                Language
                <input
                  value={editing.language}
                  onChange={(e) =>
                    setEditing({ ...editing, language: e.target.value })
                  }
                />
              </label>
              <label>
                Context
                <textarea
                  value={editing.context}
                  onChange={(e) =>
                    setEditing({ ...editing, context: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <Button type="submit" className="primary" disabled={busy}>
            Save term
          </Button>
        </form>
      </Modal>
    </div>
  );
}
function Flashcards({
  entries,
  refresh,
  onError,
}: {
  entries: GlossaryEntry[];
  refresh: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const due = entries
    .filter((e) => e.dueAt <= now && !reviewed.includes(e.id))
    .sort((a, b) => a.dueAt - b.dueAt);
  const entry = due[0];
  async function grade(quality: number) {
    if (!entry) return;
    setBusy(true);
    const interval =
      quality === 0
        ? 0
        : quality === 1
          ? 1
          : Math.max(
              2,
              Math.round((entry.interval || 1) * (quality === 2 ? 2 : 3)),
            );
    const dueAt =
      Date.now() + (quality === 0 ? 10 * 60000 : interval * 86400000);
    try {
      await api.updateGlossary(entry.id, {
        interval,
        dueAt,
        repetitions: quality === 0 ? 0 : entry.repetitions + 1,
      });
      setReviewed((items) => [...items, entry.id]);
      setRevealed(false);
      await refresh();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flashcards">
      <div className="section-title">
        <h3>Recall, then reveal</h3>
        <span>{due.length} due</span>
      </div>
      {entry ? (
        <article className="flashcard">
          <BookOpen size={26} />
          <h2>{entry.term}</h2>
          <blockquote className="prose">{entry.context}</blockquote>
          {revealed ? (
            <>
              <div className="flashcard-answer">
                <p className="prose">{entry.definition}</p>
                {entry.translation && (
                  <p className="prose">{entry.translation}</p>
                )}
              </div>
              <p className="muted">How well did you remember?</p>
              <div className="grade-buttons">
                {[
                  [0, "Again"],
                  [1, "Hard"],
                  [2, "Good"],
                  [3, "Easy"],
                ].map(([grade, label]) => (
                  <Button
                    key={grade}
                    disabled={busy}
                    onClick={() => void gradeRecall(grade)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button className="primary" onClick={() => setRevealed(true)}>
              Reveal definition
            </Button>
          )}
        </article>
      ) : (
        <Empty title={entries.length ? "You’re up to date" : "No cards yet"}>
          <p>
            {entries.length
              ? "Your next reviews will appear when they are due."
              : "Save glossary terms to create contextual flashcards."}
          </p>
        </Empty>
      )}
    </div>
  );
  function gradeRecall(value: string | number) {
    return grade(Number(value));
  }
}
