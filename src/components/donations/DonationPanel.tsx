"use client";

import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-8 gap-2"
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Gekopieerd" : `Kopieer ${label}`}
    </Button>
  );
}

export default function DonationPanel() {
  const btc = process.env.NEXT_PUBLIC_BTC_ADDRESS || "";
  const eth = process.env.NEXT_PUBLIC_ETH_ADDRESS || "";

  const hasAddresses = btc.length > 0 || eth.length > 0;

  const btcLabel = useMemo(
    () => (btc.length > 0 ? btc : "BTC-adres niet ingesteld"),
    [btc],
  );
  const ethLabel = useMemo(
    () => (eth.length > 0 ? eth : "ETH-adres niet ingesteld"),
    [eth],
  );

  return (
    <Card className="p-5 space-y-5 border border-border/70 bg-card/80 backdrop-blur">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Steun dit project</h2>
        <p className="text-sm text-muted-foreground">
          Help de hosting gratis te houden. Donaties worden gebruikt voor
          scraping, analyse en AI-kosten.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Bitcoin (BTC)</p>
            {btc && <CopyButton value={btc} label="BTC" />}
          </div>
          <div
            className={cn(
              "rounded-xl border p-3 text-xs break-all",
              btc ? "bg-muted/40" : "bg-muted/20 text-muted-foreground",
            )}
          >
            {btcLabel}
          </div>
          {btc && (
            <div className="flex justify-center rounded-xl border bg-background p-4">
              <QRCodeCanvas value={btc} size={140} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ethereum (ETH)</p>
            {eth && <CopyButton value={eth} label="ETH" />}
          </div>
          <div
            className={cn(
              "rounded-xl border p-3 text-xs break-all",
              eth ? "bg-muted/40" : "bg-muted/20 text-muted-foreground",
            )}
          >
            {ethLabel}
          </div>
          {eth && (
            <div className="flex justify-center rounded-xl border bg-background p-4">
              <QRCodeCanvas value={eth} size={140} />
            </div>
          )}
        </div>
      </div>

      {!hasAddresses && (
        <p className="text-xs text-muted-foreground">
          Voeg je BTC/ETH adres toe in <code>.env.local</code> om QR-codes te
          tonen.
        </p>
      )}
    </Card>
  );
}
