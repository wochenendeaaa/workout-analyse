import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Workout-Analyse",
    template: "%s · Workout-Analyse",
  },
  description:
    "PDF-Trainingsplan hochladen, Progressive Overload und Coach-Tipps per Gemini",
  appleWebApp: {
    capable: true,
    title: "Workout-Analyse",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Workout-Analyse",
    description:
      "PDF-Trainingsplan hochladen, Progressive Overload und Coach-Tipps per Gemini",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Workout-Analyse",
    description:
      "PDF-Trainingsplan hochladen, Progressive Overload und Coach-Tipps per Gemini",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
