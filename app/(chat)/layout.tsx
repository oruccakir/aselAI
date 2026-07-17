import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import type { AppUser } from "@/lib/types";

// TODO(ACP): real user identity should come from the connected agent.
const STUB_USER: AppUser = { email: "guest", id: "local-user" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
          <SidebarShell>{children}</SidebarShell>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    // ActiveChatProvider wraps the sidebar too, so the history list can
    // read the selected agent and stay in sync with the picker.
    <ActiveChatProvider>
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar user={STUB_USER} />
        <SidebarInset>
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={{
              className:
                "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
            }}
          />
          <Suspense fallback={<div className="flex h-dvh" />}>
            <ChatShell />
          </Suspense>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ActiveChatProvider>
  );
}
