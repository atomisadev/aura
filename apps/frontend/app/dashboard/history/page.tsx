"use client";

import { useEffect, useState } from "react";
import {
  FileAudio,
  Download,
  History,
  ExternalLink,
  Loader2,
  Music,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type HistoryItem = {
  id: string;
  name: string;
  url?: string | null;
  processedUrl?: string | null;
  isExpired?: boolean;
  createdAt: string | Date;
};

const formatCreatedAt = (value: Date | string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const response = await fetch(`${apiBaseUrl}/history`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch history");

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      setError("Could not load your upload history.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLinks = async (id: string) => {
    setRefreshingId(id);
    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const response = await fetch(`${apiBaseUrl}/history/${id}/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to refresh links");

      await fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <section className="mx-auto flex h-fit w-full max-w-4xl flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="size-6 text-primary" />
            Recently Uploaded
          </h1>
          <p className="text-muted-foreground">
            Access and download your previously watermarked audio assets.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading your library...
          </p>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-10 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="link" onClick={fetchHistory} className="mt-2">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : history.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center justify-center text-center gap-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <Music className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-lg">No history found</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                You haven't watermarked any audio files yet. Your processed
                assets will appear here.
              </p>
            </div>
            <Button asChild className="mt-2">
              <a href="/dashboard">Watermark your first file</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {history.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden transition-all hover:border-primary/30"
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center p-4 gap-6">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="size-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileAudio className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-bold text-foreground truncate"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatCreatedAt(item.createdAt)}
                        </span>
                        {item.processedUrl && (
                          <div className="flex items-center rounded-full border px-2 py-0.5 bg-green-500/5 text-green-600 border-green-500/20 text-[10px] font-medium leading-none">
                            Watermarked
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.isExpired ? (
                      <div className="flex flex-col items-end gap-2 pr-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 italic">
                          Links expired (1h limit)
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 gap-2 font-semibold"
                          onClick={() => refreshLinks(item.id)}
                          disabled={refreshingId === item.id}
                        >
                          {refreshingId === item.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ExternalLink className="size-4" />
                          )}
                          Restore Access
                        </Button>
                      </div>
                    ) : (
                      <>
                        {item.url && (
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground px-1">
                              Original Source
                            </p>
                            <div className="flex items-center gap-2">
                              <audio
                                src={item.url}
                                className="h-8 w-40"
                                controls
                              />
                              <Button
                                variant="secondary"
                                size="icon"
                                className="size-8"
                                asChild
                              >
                                <a
                                  href={item.url}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download className="size-4" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        )}

                        {item.processedUrl && (
                          <div className="flex flex-col gap-2 border-l pl-4 border-border">
                            <p className="text-[10px] font-bold uppercase text-primary px-1">
                              Watermarked Asset
                            </p>
                            <div className="flex items-center gap-2">
                              <audio
                                src={item.processedUrl}
                                className="h-8 w-40"
                                controls
                              />
                              <Button
                                variant="default"
                                size="icon"
                                className="size-8"
                                asChild
                              >
                                <a
                                  href={item.processedUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download className="size-4" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
