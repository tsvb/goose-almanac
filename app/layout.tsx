import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { getExperience } from "@/lib/experience.server";
import { JsonLd } from "./_components/json-ld";
import { siteJsonLd } from "@/lib/jsonld";

// Fancy display face.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
// Fancy body + mono.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});
// Functional: one grotesque for everything + a mono for figures.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
// Minimal uses the system font stack (no webfont) — see globals.css.

export const metadata: Metadata = {
  title: { default: "Goose Almanac — every show, every night", template: "%s · Goose Almanac" },
  description:
    "An almanac of every Goose show: full setlists with segues and jams, venues, tours, and the story of each night. Data from elgoose.net.",
};

// Pages read live DB data and `current_date` (e.g. "On This Day"), so render
// per-request rather than freezing at build time.
export const dynamic = "force-dynamic";

// Set the saved theme before first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('ga-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const experience = await getExperience();
  return (
    <html
      lang="en"
      data-theme="dark"
      data-experience={experience}
      className={`${bricolage.variable} ${hanken.variable} ${jetbrains.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={siteJsonLd()} />
      </head>
      <body className="flex min-h-screen flex-col">
        {experience === "fancy" && <div className="grain-overlay" aria-hidden />}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
