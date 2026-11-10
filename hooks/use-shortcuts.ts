"use client";
import { useEffect, useEffectEvent } from "react";
import { matchCommand, type CommandId } from "@/lib/shortcuts";
export function useShortcuts(
  overrides: Record<string, string>,
  run: (id: CommandId) => void,
) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    // Radix owns keys while its modal or popover is open; keep dismissal local.
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    const command = matchCommand(
      event,
      overrides,
      /Mac|iPhone|iPad/.test(navigator.platform),
    );
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
