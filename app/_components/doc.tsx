import Link from "next/link";
import type { ReactNode } from "react";
import { showHref, locationLine } from "@/lib/queries/format";
import type { ShowSummary } from "@/lib/queries/shows";

export function Doc({ children }: { children: ReactNode }) {
  return <div className="doc">{children}</div>;
}

export function Breadcrumb({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav className="doc-crumb">
      {trail.map((t, i) => (
        <span key={i}>
          {i > 0 ? " › " : ""}
          {t.href ? <Link href={t.href}>{t.label}</Link> : <span>{t.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function MetaTable({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <table className="doc-meta">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="k">{r.k}</td>
            <td>{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ShowTable({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) return <p>No shows.</p>;
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Venue</th>
          <th>Location</th>
          <th className="num">Songs</th>
        </tr>
      </thead>
      <tbody>
        {shows.map((s) => (
          <tr key={s.showId} id={`show-${s.showId}`} className="show-anchor">
            <td className="nowrap">
              <Link href={showHref(s.date, s.order)}>{s.date}</Link>
            </td>
            <td>{s.venue ?? "Unknown venue"}</td>
            <td>{locationLine(s.city, s.state, s.country) || "—"}</td>
            <td className="num">{s.songCount > 0 ? s.songCount : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EntityTable({
  rows,
}: {
  rows: { href: string; name: string; sub?: string; count?: ReactNode }[];
}) {
  return (
    <table className="doc-table">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <Link href={r.href}>{r.name}</Link>
              {r.sub ? <span className="sub"> — {r.sub}</span> : null}
            </td>
            <td className="num">{r.count ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="doc-h2">{title}</h2>
      {children}
    </section>
  );
}

export function Footnotes({ notes }: { notes: { id: string; text: string }[] }) {
  if (notes.length === 0) return null;
  return (
    <ol className="doc-notes">
      {notes.map((n) => (
        <li key={n.id} id={n.id}>{n.text}</li>
      ))}
    </ol>
  );
}
