"use client";
import { useEffect, useEffectEvent } from "react";
import { matchCommand, type CommandId } from "@/lib/shortcuts";
export function useShortcuts(
  overrides: Record<string, string>,
  run: (id: CommandId) => void,
) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    const command = matchCommand(
      event,
      overrides,
      /Mac|iPhone|iPad/.test(navigator.platform),
    );
    if (command?.id === "escape" && event.key !== "Escape") {
      event.preventDefault();
      (document.activeElement ?? document).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      return;
    }
    // Dialog focus traps own navigation; custom dismissal uses the same Escape path.
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    if (command) {
      event.preventDefault();
      run(command.id);
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
