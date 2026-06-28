import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Doc, Breadcrumb } from "@/app/_components/doc";
import { SongIndexTable } from "@/app/_components/song";
import { listSongs, type SongSort, type SongFacet } from "@/lib/queries/songs";
import { getExperience } from "@/lib/experience.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Songs", description: "Every Goose song, sortable by plays, rarity, gap, and debut." };

const SORTS: { key: SongSort; label: string }[] = [
  { key: "played", label: "Most played" }, { key: "rare", label: "Rarest" },
  { key: "overdue", label: "Most overdue" }, { key: "recent", label: "Recently played" },
  { key: "debut", label: "By debut" }, { key: "az", label: "A–Z" },
];
const FACETS: { key: SongFacet; label: string }[] = [
  { key: "all", label: "All" }, { key: "originals", label: "Originals" }, { key: "covers", label: "Covers" },
];

type SP = { sort?: SongSort; facet?: SongFacet; q?: string };

export default async function SongsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { sort = "played", facet = "all", q = "" } = await searchParams;
  const rows = await listSongs({ sort, facet, q });
  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Songs" }]} />
          <h1>Songs</h1>
          <p className="doc-crumb">{rows.length} songs · sorted by {SORTS.find((s) => s.key === sort)?.label}</p>
          <p className="doc-crumb">
            {SORTS.map((s) => <span key={s.key}>{s.key === sort ? <strong>{s.label}</strong> : <Link href={`/songs?sort=${s.key}`}>{s.label}</Link>}{" · "}</span>)}
          </p>
          <table className="doc-table">
            <thead><tr><th>Song</th><th className="num">Played</th><th className="num">Gap</th><th>Last</th><th>Debut</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.songId}>
                  <td><Link href={`/songs/${r.slug}`}>{r.name}</Link>{!r.isOriginal ? " (cover)" : ""}</td>
                  <td className="num">{r.timesPlayed}</td><td className="num">{r.currentGap ?? "—"}</td>
                  <td>{r.lastPlayedDate ?? "—"}</td><td>{r.debutYear ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Doc>
      </Container>
    );
  }

  // Fancy + Functional share this dense body.
  const yearsForTable = rows[0] ? deriveYears(rows) : [];
  return (
    <>
      <header className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-10 sm:py-12">
          <span className="eyebrow">The catalog</span>
          <h1 className="mt-3 font-display text-[2.4rem] leading-none tracking-tight text-ink sm:text-5xl">Songs</h1>
          <p className="mt-2 font-mono text-xs text-faint">{rows.length} songs · sort the whole catalog any way you like</p>
        </Container>
      </header>
      <Container className="py-8">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {SORTS.map((s) => (
            <Link key={s.key} href={buildHref({ sort: s.key, facet, q })}
              className={s.key === sort ? "rounded-full bg-gold/15 px-3 py-1 text-gold ring-1 ring-gold/40" : "rounded-full px-3 py-1 text-muted transition hover:text-ink"}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[0.7rem] text-faint">
          Filter:
          {FACETS.map((f) => (
            <Link key={f.key} href={buildHref({ sort, facet: f.key, q })}
              className={f.key === facet ? "rounded-full px-2.5 py-0.5 text-gold ring-1 ring-gold/40" : "rounded-full px-2.5 py-0.5 text-muted transition hover:text-ink"}>
              {f.label}
            </Link>
          ))}
        </div>
        <SongIndexTable rows={rows} years={yearsForTable} />
      </Container>
    </>
  );
}

function buildHref(sp: { sort: string; facet: string; q: string }) {
  const u = new URLSearchParams();
  if (sp.sort !== "played") u.set("sort", sp.sort);
  if (sp.facet !== "all") u.set("facet", sp.facet);
  if (sp.q) u.set("q", sp.q);
  const qs = u.toString();
  return qs ? `/songs?${qs}` : "/songs";
}
// The index rows carry counts aligned to the band's year span; recover labels from the first row length.
function deriveYears(rows: { playsPerYear: number[] }[]): number[] {
  const n = rows[0].playsPerYear.length;
  const hi = new Date().getUTCFullYear();
  return Array.from({ length: n }, (_, i) => hi - (n - 1) + i);
}
