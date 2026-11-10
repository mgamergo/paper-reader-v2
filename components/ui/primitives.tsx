"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, AlertCircle, LoaderCircle } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
export { Button } from "@/components/ui/button";
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <Button
            className={`icon-button ${className}`}
            aria-label={label}
            {...props}
          >
            {children}
          </Button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip" sideOffset={5}>
            {label}
            <TooltipPrimitive.Arrow />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          className={`modal ${wide ? "modal-wide" : ""}`}
        >
          <header className="modal-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {description ?? ""}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button aria-label="Close dialog">
                <X size={18} />
              </Button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Popover({
  trigger,
  children,
  onOpenChange,
  open,
  contentId,
  onPointerEnter,
  onPointerLeave,
  preview = false,
}: {
  trigger: ReactNode;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  contentId?: string;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  preview?: boolean;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={contentId}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onOpenAutoFocus={(event) => {
            if (preview) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            const focused = document.activeElement;
            if (
              focused instanceof HTMLElement &&
              focused !== document.body &&
              !focused.closest(".popover")
            )
              event.preventDefault();
          }}
          className="popover"
          sideOffset={8}
          collisionPadding={12}
        >
          {children}
          <PopoverPrimitive.Close
            className="popover-close"
            aria-label="Close preview"
          >
            <X size={16} />
          </PopoverPrimitive.Close>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <div>
        {message}
        {retry && <Button onClick={retry}>Retry</Button>}
      </div>
    </div>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={19} className="spinner" />
      {text}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export function HoverPopover({
  trigger,
  children,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holder = useRef<HTMLSpanElement>(null);
  const contentId = useId();
  const suppressReturnFocus = useRef(false);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function change(value: boolean) {
    if (!value) {
      suppressReturnFocus.current = true;
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => {
        suppressReturnFocus.current = false;
      }, 200);
    }
    setOpen(value);
    onOpenChange?.(value);
  }
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
  }
  function scheduleClose() {
    cancel();
    timer.current = setTimeout(() => {
      const focused = document.activeElement;
      if (
        !holder.current?.contains(focused) &&
        !document.getElementById(contentId)?.contains(focused)
      )
        change(false);
    }, 220);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (focusTimer.current) clearTimeout(focusTimer.current);
    },
    [],
  );
  return (
    <span
      ref={holder}
      onMouseEnter={() => {
        cancel();
        timer.current = setTimeout(() => change(true), 140);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancel();
        if (!suppressReturnFocus.current) change(true);
      }}
      onBlur={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          change(true);
          requestAnimationFrame(() =>
            document
              .getElementById(contentId)
              ?.querySelector<HTMLElement>("button,a,input,select")
              ?.focus(),
          );
        }
      }}
    >
      <Popover
        open={open}
        onOpenChange={change}
        contentId={contentId}
        onPointerEnter={cancel}
        onPointerLeave={scheduleClose}
        preview
        trigger={trigger}
      >
        {children}
      </Popover>
    </span>
  );
}
