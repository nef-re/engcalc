import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "EngCalc — инженерные калькуляторы",
  description: "Калькуляторы ЭОМ, ЭС, вентиляция. Подбор кабелей, КЗ, ΔU.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} min-h-screen antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
