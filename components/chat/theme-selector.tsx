"use client";

import {
  CrosshairIcon,
  MoonIcon,
  PaletteIcon,
  RadarIcon,
  SunIcon,
} from "lucide-react";
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
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

type ThemeId = "light" | "dark" | "asel" | "tactical" | "nvg";

const themes: Array<{
  description: (dict: Dictionary) => string;
  icon: ReactNode;
  id: ThemeId;
  label: (dict: Dictionary) => string;
}> = [
  {
    description: (dict) => dict.themes.lightDescription,
    icon: <SunIcon size={16} />,
    id: "light",
    label: (dict) => dict.themes.light,
  },
  {
    description: (dict) => dict.themes.darkDescription,
    icon: <MoonIcon size={16} />,
    id: "dark",
    label: (dict) => dict.themes.dark,
  },
  {
    description: (dict) => dict.themes.aselDescription,
    icon: <PaletteIcon size={16} />,
    id: "asel",
    label: (dict) => dict.themes.asel,
  },
  {
    description: (dict) => dict.themes.tacticalDescription,
    icon: <CrosshairIcon size={16} />,
    id: "tactical",
    label: (dict) => dict.themes.tactical,
  },
  {
    description: (dict) => dict.themes.nvgDescription,
    icon: <RadarIcon size={16} />,
    id: "nvg",
    label: (dict) => dict.themes.nvg,
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
  const { dict } = useLocale();
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
          {theme.label(dict)}
        </div>
        <div className="text-muted-foreground text-xs">
          {theme.description(dict)}
        </div>
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
  const { dict } = useLocale();
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
          <SunIcon className="size-4 dark:hidden asel:hidden tactical:hidden nvg:hidden" />
          <MoonIcon className="hidden size-4 dark:block asel:hidden tactical:hidden nvg:hidden" />
          <PaletteIcon className="hidden size-4 asel:block tactical:hidden nvg:hidden" />
          <CrosshairIcon className="hidden size-4 tactical:block nvg:hidden" />
          <RadarIcon className="hidden size-4 nvg:block" />
          <span className="md:sr-only">
            <span className="dark:hidden asel:hidden tactical:hidden nvg:hidden">
              {dict.themes.light}
            </span>
            <span className="hidden dark:block asel:hidden tactical:hidden nvg:hidden">
              {dict.themes.dark}
            </span>
            <span className="hidden asel:block tactical:hidden nvg:hidden">
              {dict.themes.asel}
            </span>
            <span className="hidden tactical:block nvg:hidden">
              {dict.themes.tactical}
            </span>
            <span className="hidden nvg:block">{dict.themes.nvg}</span>
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
