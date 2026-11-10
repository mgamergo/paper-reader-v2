"use client";
import { useState } from "react";
import { Keyboard, Search } from "lucide-react";
import {
  bindingFor,
  commands,
  eventBinding,
  validateBinding,
  type CommandId,
} from "@/lib/shortcuts";
import { Button, ErrorBox, Modal } from "./ui/primitives";
export function CommandCenter({
  palette,
  help,
  onPalette,
  onHelp,
  overrides,
  onRun,
  onRemap,
}: {
  palette: boolean;
  help: boolean;
  onPalette: (open: boolean) => void;
  onHelp: (open: boolean) => void;
  overrides: Record<string, string>;
  onRun: (id: CommandId) => void;
  onRemap: (overrides: Record<string, string>) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(id: string) {
    const conflict = validateBinding(id, draft, overrides);
    if (conflict) {
      setError(conflict);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRemap({ ...overrides, [id]: draft });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save shortcuts.");
    } finally {
      setBusy(false);
    }
  }
  const filtered = commands.filter((c) =>
    `${c.label} ${bindingFor(c, overrides)}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <Modal
        open={palette}
        onOpenChange={onPalette}
        title="Command palette"
        description="Search actions and discover your keyboard bindings."
      >
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search commands"
            autoComplete="off"
            placeholder="What would you like to do?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="command-list">
          {filtered.map((command) => (
            <button
              key={command.id}
              onClick={() => {
                onPalette(false);
                setQuery("");
                setTimeout(() => onRun(command.id), 0);
              }}
            >
              <span>{command.label}</span>
              <kbd>{bindingFor(command, overrides)}</kbd>
            </button>
          ))}
          {!filtered.length && <p>No matching command.</p>}
        </div>
      </Modal>
      <Modal
        open={help}
        onOpenChange={onHelp}
        wide
        title="Make the keyboard yours"
        description="Mod is ⌘ on Mac and Ctrl elsewhere. Shortcuts pause while typing, except global commands."
      >
        <label className="search-box">
          <Keyboard size={17} />
          <input
            aria-label="Search keyboard shortcuts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts…"
          />
        </label>
        {error && <ErrorBox message={error} />}
        <div className="shortcut-list">
          {filtered.map((command) => (
            <div className="shortcut-row" key={command.id}>
              <span>
                {command.label}
                {"global" in command && <small>Global</small>}
                {"searchOnly" in command && <small>In PDF search</small>}
              </span>
              {editing === command.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(command.id);
                  }}
                >
                  <input
                    aria-label={`Binding for ${command.label}`}
                    value={draft}
                    placeholder="Press a key…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") return;
                      if (e.key === "Escape") {
                        setEditing(null);
                        return;
                      }
                      e.preventDefault();
                      if (["Control", "Meta", "Shift", "Alt"].includes(e.key))
                        return;
                      setDraft(
                        eventBinding(
                          e.nativeEvent,
                          /Mac|iPhone|iPad/.test(navigator.platform),
                        ),
                      );
                    }}
                  />
                  <Button type="submit" disabled={busy}>
                    Save
                  </Button>
                  <Button onClick={() => setEditing(null)}>Cancel</Button>
                </form>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(command.id);
                    setDraft(bindingFor(command, overrides));
                    setError("");
                  }}
                >
                  <kbd>{bindingFor(command, overrides)}</kbd>Change
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRemap({})
              .catch((e) =>
                setError(
                  e instanceof Error ? e.message : "Could not reset shortcuts",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          Reset default shortcuts
        </Button>
      </Modal>
    </>
  );
}
