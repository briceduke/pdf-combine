import type { Metadata } from "next"
import { Figtree, Geist_Mono } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

import "./globals.css"

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "PDF Combine",
  description:
    "Combine PDFs in your browser. Small jobs never leave the device. Large jobs need a one-time email sign-in.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full overflow-hidden overscroll-none font-sans antialiased",
        fontMono.variable,
        figtree.variable
      )}
    >
      <body className="h-full overflow-hidden overscroll-none">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
