export const commands = [
  { id: "palette", label: "Command palette", key: "Mod+k", global: true },
  { id: "shortcuts", label: "Keyboard shortcuts and remapping", key: "?" },
  { id: "scrollDown", label: "Scroll down", key: "j" },
  { id: "scrollUp", label: "Scroll up", key: "k" },
  { id: "first", label: "First page", key: "g" },
  { id: "last", label: "Last page", key: "Shift+g" },
  { id: "next", label: "Next page", key: "PageDown" },
  { id: "previous", label: "Previous page", key: "PageUp" },
  { id: "search", label: "Search document", key: "/" },
  {
    id: "searchGlobal",
    label: "Search document (global)",
    key: "Mod+f",
    global: true,
  },
  {
    id: "searchNext",
    label: "Next search match",
    key: "Enter",
    searchOnly: true,
  },
  {
    id: "searchPrevious",
    label: "Previous search match",
    key: "Shift+Enter",
    searchOnly: true,
  },
  { id: "zoomIn", label: "Zoom in", key: "+" },
  { id: "zoomOut", label: "Zoom out", key: "-" },
  { id: "zoomReset", label: "Reset zoom", key: "0" },
  { id: "fitWidth", label: "Fit width", key: "w" },
  { id: "fitPage", label: "Fit page", key: "f" },
  { id: "rotate", label: "Rotate clockwise", key: "r" },
  { id: "outline", label: "Toggle outline", key: "o" },
  { id: "thumbnails", label: "Toggle thumbnails", key: "t" },
  { id: "dark", label: "Toggle dark theme", key: "d" },
  { id: "sepia", label: "Toggle sepia theme", key: "s" },
  { id: "chat", label: "Open document chat", key: "c" },
  { id: "explain", label: "Explain selected text", key: "e" },
  { id: "highlight", label: "Highlight selection", key: "h" },
  { id: "note", label: "Add note", key: "n" },
  { id: "bookmark", label: "Bookmark page", key: "b" },
  { id: "glossary", label: "Open personal glossary", key: "l" },
  { id: "review", label: "Review flashcards", key: "v" },
  { id: "mode", label: "Toggle continuous / single page", key: "p" },
  { id: "split", label: "Compare two papers", key: "x" },
  { id: "import", label: "Import paper", key: "Mod+o", global: true },
  { id: "focus", label: "Toggle focus mode", key: "Shift+f" },
  {
    id: "escape",
    label: "Close popup / palette / drawer",
    key: "Escape",
    global: true,
  },
] satisfies {
  id: string;
  label: string;
  key: string;
  global?: boolean;
  searchOnly?: boolean;
}[];
export type CommandId = (typeof commands)[number]["id"];
export type Command = (typeof commands)[number];
export function normalizeBinding(input: string): string {
  if (input === "+") return "+";
  const parts = input.trim().split("+");
  let key = parts.pop() ?? "";
  if (!key && parts.at(-1) === "") {
    parts.pop();
    key = "+";
  }
  const modifiers = parts.map((part) => part.toLowerCase());
  return [
    ...(modifiers.includes("mod") ? ["Mod"] : []),
    ...(modifiers.includes("alt") ? ["Alt"] : []),
    ...(modifiers.includes("shift") ? ["Shift"] : []),
    key.length === 1
      ? key.toLowerCase()
      : ({
          escape: "Escape",
          enter: "Enter",
          pageup: "PageUp",
          pagedown: "PageDown",
          space: "Space",
        }[key.toLowerCase()] ?? key),
  ].join("+");
}
export function eventBinding(
  event: Pick<
    KeyboardEvent,
    "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
  >,
  mac: boolean,
): string {
  // Do not mistake Ctrl for Cmd on a Mac, or a Windows meta key for Ctrl.
  if (mac ? event.ctrlKey : event.metaKey) return "";
  const literalShift = ["?", "+"].includes(event.key);
  return [
    ...((mac ? event.metaKey : event.ctrlKey) ? ["Mod"] : []),
    ...(event.altKey ? ["Alt"] : []),
    ...(event.shiftKey && !literalShift ? ["Shift"] : []),
    event.key === " "
      ? "Space"
      : event.key.length === 1
        ? event.key.toLowerCase()
        : event.key,
  ].join("+");
}
export function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]",
    )
  );
}
export function bindingFor(
  command: Command,
  overrides: Record<string, string>,
): string {
  return overrides[command.id] ?? command.key;
}
export function validateBinding(
  commandId: string,
  candidate: string,
  overrides: Record<string, string>,
): string | null {
  const normalized = normalizeBinding(candidate);
  if (
    !normalized ||
    !/^(?:(?:Mod|Alt|Shift)\+)*(?:[a-z0-9/?.=\-]|\+|Enter|Escape|PageDown|PageUp|Home|End|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|F(?:[1-9]|1[0-2]))$/.test(
      normalized,
    )
  )
    return "Use a key such as j, Shift+g, or Mod+k.";
  if (commandId === "escape" && normalized !== "Escape")
    return "Escape must remain available to dismiss overlays.";
  if (normalized === "Escape" && commandId !== "escape")
    return "Escape is reserved for closing overlays.";
  const command = commands.find((item) => item.id === commandId);
  if (
    command &&
    "global" in command &&
    commandId !== "escape" &&
    !/^(Mod|Alt)\+/.test(normalized)
  )
    return "Global commands need Mod or Alt so typing stays available.";
  if (/Shift\+(?:[0-9/?.=\-]|\+)$/.test(normalized))
    return "Use the resulting punctuation key directly (for example ? or +), rather than Shift plus a symbol.";
  const conflict = commands.find(
    (command) =>
      command.id !== commandId &&
      normalizeBinding(bindingFor(command, overrides)) === normalized,
  );
  return conflict ? `Already used by “${conflict.label}”.` : null;
}
export function matchCommand(
  event: KeyboardEvent,
  overrides: Record<string, string>,
  mac: boolean,
): Command | undefined {
  if (
    event.isComposing ||
    event.defaultPrevented ||
    (event.repeat && !["j", "k", "PageDown", "PageUp"].includes(event.key))
  )
    return undefined;
  const binding = eventBinding(event, mac);
  return resolveCommand(binding, overrides, {
    editing: isEditable(event.target),
    search:
      event.target instanceof HTMLElement &&
      event.target.dataset.pdfSearch === "true",
  });
}

export function resolveCommand(
  binding: string,
  overrides: Record<string, string>,
  context: { editing: boolean; search: boolean },
): Command | undefined {
  return commands.find(
    (command) =>
      normalizeBinding(bindingFor(command, overrides)) === binding &&
      (!("searchOnly" in command) || context.search) &&
      (!context.editing || "global" in command || "searchOnly" in command),
  );
}
