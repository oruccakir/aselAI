"use client";

import { CaseUpperIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

const languages: Array<{
  id: Locale;
  flag: string;
  label: (dict: Dictionary) => string;
  description: (dict: Dictionary) => string;
}> = [
  {
    description: (dict) => dict.language.englishDescription,
    flag: "🇬🇧",
    id: "en",
    label: (dict) => dict.language.english,
  },
  {
    description: (dict) => dict.language.turkishDescription,
    flag: "🇹🇷",
    id: "tr",
    label: (dict) => dict.language.turkish,
  },
];

function LanguageSelectorItem({
  language,
  setOpen,
}: {
  language: (typeof languages)[number];
  setOpen: (open: boolean) => void;
}) {
  const { locale, setLocale, dict } = useLocale();

  const handleSelect = useCallback(() => {
    setLocale(language.id);
    setOpen(false);
  }, [language.id, setLocale, setOpen]);

  return (
    <DropdownMenuItem
      className="group/item flex flex-row items-center justify-between gap-4"
      data-active={language.id === locale}
      data-testid={`language-selector-item-${language.id}`}
      onSelect={handleSelect}
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{language.flag}</span>
          {language.label(dict)}
        </div>
        <div className="text-muted-foreground text-xs">
          {language.description(dict)}
        </div>
      </div>
      <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
        <CheckCircleFillIcon />
      </div>
    </DropdownMenuItem>
  );
}

export function LanguageSelector({
  className,
}: React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();

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
          data-testid="language-selector"
          size="sm"
          variant="outline"
        >
          <CaseUpperIcon className="size-4" />
          <span className="uppercase md:sr-only">{locale}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[220px]">
        {languages.map((language) => (
          <LanguageSelectorItem
            key={language.id}
            language={language}
            setOpen={setOpen}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
