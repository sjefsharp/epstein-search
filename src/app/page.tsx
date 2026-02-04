import ChatContainer from "@/components/chat/ChatContainer";
import DonationPanel from "@/components/donations/DonationPanel";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.15),_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_40%,_#e5e7eb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_50%),linear-gradient(180deg,_#0f172a_0%,_#0b1120_100%)]">
      <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Epstein Files • DOJ.gov
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Zoek, analyseer en contextualiseer DOJ Epstein documenten
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Een gesprek-gedreven zoekagent die DOJ data direct doorzoekt, met
            AI-samenvattingen en directe links naar bronbestanden.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ChatContainer />

          <aside className="space-y-6">
            <DonationPanel />

            <Card className="p-5 space-y-3 border border-border/70 bg-card/80 backdrop-blur">
              <h2 className="text-sm font-semibold">Over deze index</h2>
              <p className="text-sm text-muted-foreground">
                De zoekresultaten zijn gebaseerd op de DOJ multimedia-search
                index. PDF-links openen in een nieuw tabblad op DOJ.gov.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Snelle zoekmodus gebruikt geïndexeerde DOJ tekst.</li>
                <li>• Diepe analyse haalt de PDF on-demand op.</li>
                <li>• Samenvattingen worden automatisch gegenereerd.</li>
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
