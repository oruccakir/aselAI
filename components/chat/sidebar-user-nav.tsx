"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AppUser } from "@/lib/types";

function emailToHue(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SidebarUserNav({ user }: { user: AppUser }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-8 px-2 rounded-lg bg-transparent text-sidebar-foreground/70"
          data-testid="user-nav-button"
        >
          <div
            className="size-5 shrink-0 rounded-full ring-1 ring-sidebar-border/50"
            style={{
              background: `linear-gradient(135deg, oklch(0.35 0.08 ${emailToHue(user.email)}), oklch(0.25 0.05 ${emailToHue(user.email) + 40}))`,
            }}
          />
          <span className="truncate text-[14px]" data-testid="user-email">
            Guest
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
