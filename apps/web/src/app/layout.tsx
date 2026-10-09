import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Raven",
  description: "I'm doing this anyway — come if you fancy it.",
};

export const viewport: Viewport = {
  themeColor: "#FFFBF5",
};

// suppressHydrationWarning on <html>: browser extensions (scroll-lock/theme
// ones in particular) commonly inject a style attribute there before React
// hydrates — this app sets nothing on <html> itself. Scoped to this one
// element; a real mismatch anywhere else in the tree still surfaces normally.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
