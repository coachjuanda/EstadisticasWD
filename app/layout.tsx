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

export const metadata: Metadata = {
  title: "Hockey.One",
  description: "Estadísticas y gestión deportiva — Hockey.One Academy",
  appleWebApp: {
    capable: true,
    title: "Wild Dogs",
    statusBarStyle: "default",
  },
  other: {
    // Next 16 sólo emite el meta "mobile-web-app-capable" estándar (el que
    // usa Chrome/Android) a partir de appleWebApp.capable. Safari en iPhone
    // sigue buscando específicamente el nombre con prefijo "apple-", así
    // que se agrega a mano para no depender de que Safari ya soporte el
    // estándar nuevo.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1840f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
