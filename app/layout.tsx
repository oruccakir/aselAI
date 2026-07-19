import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n/locale-context";

import "./globals.css";

export const metadata: Metadata = {
  description: "ASELSAN Agent Intelligence",
  metadataBase: new URL("https://www.aselsan.com/tr/"),
  title: "ASELSAN AI",
};

export const viewport = {
  maximumScale: 1,
};

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const ASEL_THEME_COLOR = "hsl(225deg 35% 9%)";
const TACTICAL_THEME_COLOR = "hsl(45deg 12% 6%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    if (html.classList.contains('asel')) {
      meta.setAttribute('content', '${ASEL_THEME_COLOR}');
    } else if (html.classList.contains('tactical')) {
      meta.setAttribute('content', '${TACTICAL_THEME_COLOR}');
    } else if (html.classList.contains('dark')) {
      meta.setAttribute('content', '${DARK_THEME_COLOR}');
    } else {
      meta.setAttribute('content', '${LIGHT_THEME_COLOR}');
    }
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
          themes={["light", "dark", "asel", "tactical"]}
        >
          <LocaleProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
