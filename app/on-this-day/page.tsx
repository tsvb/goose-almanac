import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { ShowCard } from "@/app/_components/show-card";
import { Calendar } from "@/app/_components/marks";
import { getOnThisDay } from "@/lib/queries/shows";
import { formatMonthDay, compact } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, Breadcrumb, ShowTable } from "@/app/_components/doc";

export const metadata: Metadata = { title: "On This Day" };

export default async function OnThisDayPage() {
  const rows = await getOnThisDay();

  const title = rows.length > 0 ? formatMonthDay(rows[0].date) : "On this day";
  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "On this day" }]} />
          <h1>On this day</h1>
          {rows.length === 0 ? <p>No Goose shows on today&apos;s date.</p> : <ShowTable shows={rows} />}
        </Doc>
      </Container>
    );
  }

  return (
    <>
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-14 sm:py-20">
          <span className="eyebrow rise flex items-center gap-2" style={{ animationDelay: "0ms" }}>
            <Calendar className="h-4 w-4" />
            On this day
          </span>
          <h1
            className="rise mt-4 font-display text-[3.5rem] leading-none tracking-tight text-ink sm:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            {title}
          </h1>
          {rows.length > 0 && (
            <p
              className="rise mt-4 text-lg text-muted"
              style={{ animationDelay: "120ms" }}
            >
              Goose has played{" "}
              <span className="text-ink">{compact(rows.length)}</span>{" "}
              {rows.length === 1 ? "show" : "shows"} on this date over the years.
            </p>
          )}
        </Container>
      </header>

      {/* Shows grid or empty state */}
      <section>
        <Container className="py-12">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-2xl text-muted">
                No Goose shows fall on today&apos;s date — yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((show) => (
                <ShowCard key={show.showId} show={show} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
