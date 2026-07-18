"use client";

import { MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

type ThemeId = "light" | "dark" | "asel";

const themes: Array<{
  description: string;
  icon: ReactNode;
  id: ThemeId;
  label: string;
}> = [
  {
    description: "Bright daytime palette",
    icon: <SunIcon size={16} />,
    id: "light",
    label: "Light",
  },
  {
    description: "Dimmed low-light palette",
    icon: <MoonIcon size={16} />,
    id: "dark",
    label: "Dark",
  },
  {
    description: "ASELSAN navy + blue accent",
    icon: <PaletteIcon size={16} />,
    id: "asel",
    label: "Asel Blue",
  },
];

function ThemeSelectorItem({
  setOpen,
  setTheme,
  theme,
  themeId,
}: {
  setOpen: (open: boolean) => void;
  setTheme: (theme: ThemeId) => void;
  theme: (typeof themes)[number];
  themeId: ThemeId;
}) {
  const handleSelect = useCallback(() => {
    setTheme(theme.id);
    setOpen(false);
  }, [setOpen, setTheme, theme.id]);

  return (
    <DropdownMenuItem
      className="group/item flex flex-row items-center justify-between gap-4"
      data-active={theme.id === themeId}
      data-testid={`theme-selector-item-${theme.id}`}
      onSelect={handleSelect}
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          {theme.icon}
          {theme.label}
        </div>
        <div className="text-muted-foreground text-xs">{theme.description}</div>
      </div>
      <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
        <CheckCircleFillIcon />
      </div>
    </DropdownMenuItem>
  );
}

export function ThemeSelector({
  className,
}: React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const currentThemeId = (resolvedTheme ?? "light") as ThemeId;

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:border-border/50 active:translate-y-0"
          data-testid="theme-selector"
          size="sm"
          variant="outline"
        >
          <SunIcon className="size-4 dark:hidden asel:hidden" />
          <MoonIcon className="hidden size-4 dark:block asel:hidden" />
          <PaletteIcon className="hidden size-4 asel:block" />
          <span className="md:sr-only">
            <span className="dark:hidden asel:hidden">Light</span>
            <span className="hidden dark:block asel:hidden">Dark</span>
            <span className="hidden asel:block">Asel Blue</span>
          </span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[260px]">
        {themes.map((theme) => (
          <ThemeSelectorItem
            key={theme.id}
            setOpen={setOpen}
            setTheme={setTheme}
            theme={theme}
            themeId={currentThemeId}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
