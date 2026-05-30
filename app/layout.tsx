import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { PWARegister } from "@/components/pwa-register"
import { VoiceMode } from "@/components/voice-mode"
import CommandPalette from "@/components/command-palette"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Tan's AI Agent",
  description: "Multi-provider free AI agent · powered by shadcn/ui",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <PWARegister />
        <a
          href="#app-main-content"
          className="sr-only fixed left-3 top-3 z-[120] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Bỏ qua tới nội dung chính
        </a>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider delayDuration={300}>
              <div id="app-main-content" className="contents">
                {children}
              </div>
              <VoiceMode />
              <CommandPalette />
              <Toaster position="bottom-center" theme="system" richColors closeButton />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
