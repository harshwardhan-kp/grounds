import type { Metadata } from "next";
import { Instrument_Serif, Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

/*
 * Three faces, three jobs. The serif carries display type and quoted machine
 * text; the grotesk carries running copy; the mono carries every piece of
 * metadata — ids, hashes, parameters, bracket labels. Next self-hosts them at
 * build time, so there is no external font request at runtime.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grounds",
  description: "Every AI answer about you, cross-examined against its own sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${schibsted.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
