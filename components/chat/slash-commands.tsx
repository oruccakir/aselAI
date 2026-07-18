"use client";

import {
  BombIcon,
  ListIcon,
  PaletteIcon,
  PenLineIcon,
  PenSquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export type SlashCommand = {
  name: string;
  descriptionKey: keyof Dictionary["slash"];
  icon: ReactNode;
  action: string;
  shortcut?: string;
};

export const slashCommands: SlashCommand[] = [
  {
    action: "new",
    descriptionKey: "new",
    icon: <PenSquareIcon className="size-3.5" />,
    name: "new",
  },
  {
    action: "clear",
    descriptionKey: "clear",
    icon: <Trash2Icon className="size-3.5" />,
    name: "clear",
  },
  {
    action: "rename",
    descriptionKey: "rename",
    icon: <PenLineIcon className="size-3.5" />,
    name: "rename",
  },
  {
    action: "agent",
    descriptionKey: "agent",
    icon: <ListIcon className="size-3.5" />,
    name: "agent",
  },
  {
    action: "theme",
    descriptionKey: "theme",
    icon: <PaletteIcon className="size-3.5" />,
    name: "theme",
  },
  {
    action: "delete",
    descriptionKey: "delete",
    icon: <XIcon className="size-3.5" />,
    name: "delete",
  },
  {
    action: "purge",
    descriptionKey: "purge",
    icon: <BombIcon className="size-3.5" />,
    name: "purge",
  },
];

type SlashCommandMenuProps = {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  selectedIndex: number;
};

function SlashCommandMenuItem({
  cmd,
  index,
  onSelect,
  selectedIndex,
}: {
  cmd: SlashCommand;
  index: number;
  onSelect: (command: SlashCommand) => void;
  selectedIndex: number;
}) {
  const { dict } = useLocale();
  const handleClick = useCallback(() => {
    onSelect(cmd);
  }, [cmd, onSelect]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
    },
    []
  );

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
        index === selectedIndex ? "bg-muted/70" : "hover:bg-muted/40"
      )}
      data-selected={index === selectedIndex}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      type="button"
    >
      <div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground/60">
        {cmd.icon}
      </div>
      <span className="font-mono text-[14px] text-foreground">/{cmd.name}</span>
      <span className="text-[12px] text-muted-foreground/50">
        {dict.slash[cmd.descriptionKey]}
      </span>
      {cmd.shortcut ? (
        <span className="ml-auto text-[11px] text-muted-foreground/30">
          {cmd.shortcut}
        </span>
      ) : null}
    </button>
  );
}

export function SlashCommandMenu({
  query,
  onSelect,
  onClose: _onClose,
  selectedIndex,
}: SlashCommandMenuProps) {
  const { dict } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const filtered = slashCommands.filter((cmd) =>
    cmd.name.startsWith(query.toLowerCase())
  );

  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, []);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-[var(--shadow-float)] backdrop-blur-xl"
      ref={menuRef}
    >
      <div className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
        {dict.slash.commandsHeading}
      </div>
      <div className="max-h-64 overflow-y-auto pb-1 no-scrollbar">
        {filtered.map((cmd, index) => (
          <SlashCommandMenuItem
            cmd={cmd}
            index={index}
            key={cmd.name}
            onSelect={onSelect}
            selectedIndex={selectedIndex}
          />
        ))}
      </div>
    </div>
  );
}
