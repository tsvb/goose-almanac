import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { getExperience } from "@/lib/experience.server";
import { JsonLd } from "./_components/json-ld";
import { siteJsonLd } from "@/lib/jsonld";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});
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
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}
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
