import { describe, expect, test } from "bun:test";
import {
  bindingFor,
  commands,
  eventBinding,
  normalizeBinding,
  validateBinding,
} from "../../lib/shortcuts";
describe("keyboard contract", () => {
  test("default bindings remain distinct and every command is reachable", () => {
    const keys = commands.map((c) => normalizeBinding(c.key));
    expect(new Set(keys).size).toBe(commands.length);
    for (const c of commands)
      expect(validateBinding(c.id, c.key, {})).toBeNull();
  });
  test("Mod follows the actual platform", () => {
    const event = {
      key: "k",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(eventBinding(event, false)).toBe("Mod+k");
    expect(eventBinding(event, true)).toBe("");
    expect(
      eventBinding({ ...event, ctrlKey: false, metaKey: true }, true),
    ).toBe("Mod+k");
    expect(
      eventBinding({ ...event, ctrlKey: false, metaKey: true }, false),
    ).toBe("");
  });
  test("shift distinguishes first/last and fit/focus but preserves literal punctuation", () => {
    const event = {
      key: "G",
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      altKey: false,
    };
    expect(eventBinding(event, false)).toBe("Shift+g");
    expect(eventBinding({ ...event, key: "?" }, false)).toBe("?");
    expect(eventBinding({ ...event, key: "+" }, false)).toBe("+");
  });
  test("remaps reject conflicts, invalid keys and stealing Escape", () => {
    expect(validateBinding("chat", "j", {})).toContain("Scroll down");
    expect(validateBinding("chat", "Escape", {})).toContain("reserved");
    expect(validateBinding("escape", "Alt+q", {})).toContain("remain");
    expect(validateBinding("chat", "", {})).not.toBeNull();
    expect(validateBinding("chat", "nonsense", {})).not.toBeNull();
    expect(validateBinding("chat", "Alt+q", {})).toBeNull();
    expect(validateBinding("chat", "Alt+q", { note: "Alt+q" })).toContain(
      "Add note",
    );
  });
  test("normalizes persisted remaps", () => {
    expect(normalizeBinding("mod+SHIFT+K")).toBe("Mod+Shift+k");
    expect(bindingFor(commands[0]!, { palette: "Alt+p" })).toBe("Alt+p");
  });
});

test("typing keeps text entry, with narrow global and search exceptions", async () => {
  const { resolveCommand } = await import("../../lib/shortcuts");
  expect(
    resolveCommand("j", {}, { editing: true, search: false }),
  ).toBeUndefined();
  expect(
    resolveCommand("e", {}, { editing: true, search: false }),
  ).toBeUndefined();
  expect(
    resolveCommand("Mod+k", {}, { editing: true, search: false })?.id,
  ).toBe("palette");
  expect(
    resolveCommand("Enter", {}, { editing: true, search: false }),
  ).toBeUndefined();
  expect(resolveCommand("Enter", {}, { editing: true, search: true })?.id).toBe(
    "searchNext",
  );
  expect(
    resolveCommand("Shift+Enter", {}, { editing: true, search: true })?.id,
  ).toBe("searchPrevious");
  expect(
    resolveCommand(
      "e",
      { explain: "Alt+e" },
      { editing: false, search: false },
    ),
  ).toBeUndefined();
  expect(
    resolveCommand(
      "Alt+e",
      { explain: "Alt+e" },
      { editing: false, search: false },
    )?.id,
  ).toBe("explain");
  expect(validateBinding("import", "q", {})).toContain("Global commands");
  expect(validateBinding("chat", "Shift+1", {})).not.toBeNull();
});

test("modified plus keys remain reachable", () => {
  expect(normalizeBinding("Mod++")).toBe("Mod++");
  expect(
    eventBinding(
      {
        key: "+",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      },
      false,
    ),
  ).toBe("Mod++");
  expect(validateBinding("zoomIn", "Mod++", {})).toBeNull();
});
