import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { AuthProvider } from "@/components/AuthProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "EngCalc — инженерный портал",
  description: "Портал инженерных расчётов: ЭОМ, ЭС, вентиляция. Калькуляторы и проектирование систем.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} min-h-screen antialiased font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
