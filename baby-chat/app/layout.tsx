import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Baby Nachrichten Chat 👶",
  description: "Erkläre deinem Baby die Nachrichten!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${nunito.className} bg-gradient-to-br from-pink-50 via-yellow-50 to-blue-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
