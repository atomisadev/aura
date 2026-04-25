"use client";

import { useState } from "react";
import {
  FileAudio,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type UploadResult = {
  bucket: string;
  key: string;
  url: string | null;
};

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [processedUploadResult, setProcessedUploadResult] =
    useState<UploadResult | null>(null);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("Error: Select an audio file before starting the process.");
      return;
    }

    setIsUploading(true);
    setStatus("Watermarking audio...");
    setUploadResult(null);
    setProcessedUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      console.log(data);

      if (res.ok && data.upload) {
        setStatus("Audio successfully watermarked!");
        setUploadResult(data.upload);
        if (data.processedUpload) {
          setProcessedUploadResult(data.processedUpload);
        }
      } else {
        setStatus(`Error: ${data.message || "Upload failed"}`);
      }
    } catch {
      setStatus("Error: Upload failed to connect to the server.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <section className="mx-auto flex h-fit w-full max-w-3xl flex-col gap-6 pb-20">
      <Card>
        <CardHeader>
          <CardTitle>Watermark Audio File</CardTitle>
          <CardDescription>
            Send a source file in for AURA to watermark
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Ready for a single audio file
              </p>
              <p className="text-sm text-muted-foreground">
                Supported by your browser file picker. Start with one track and
                the upload will be sent to the backend immediately.
              </p>
            </div>
          </div>

          <form onSubmit={upload} className="flex flex-col gap-4">
            <Label htmlFor="audio-file" className="sr-only">
              Audio file
            </Label>
            <Input
              id="audio-file"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setStatus(null);
                setUploadResult(null);
                setProcessedUploadResult(null);
              }}
            />

            <label
              htmlFor="audio-file"
              className="group block cursor-pointer rounded-lg border bg-background p-4 transition-all hover:border-primary/50 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <FileAudio className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {file ? file.name : "No file selected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {file
                      ? "Ready to upload. Click to replace."
                      : "Click to select an audio file."}
                  </p>
                </div>
              </div>
            </label>

            <Button
              type="submit"
              className="w-full"
              disabled={!file || isUploading}
            >
              {isUploading ? "Watermarking..." : "Watermark audio"}
            </Button>

            {status ? (
              <div
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                  status.startsWith("Error")
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : status.includes("successfully")
                      ? "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-border bg-muted/40 text-foreground"
                }`}
              >
                {status.startsWith("Error") ? (
                  <AlertCircle className="size-4 shrink-0" />
                ) : status.includes("successfully") ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                )}
                <p>{status.replace("Error: ", "")}</p>
              </div>
            ) : null}

            {uploadResult && (
              <div className="space-y-4 text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg border">
                <div>
                  <h4 className="font-semibold text-foreground mb-2 text-sm">
                    Original Upload
                  </h4>
                  <p>
                    <strong className="text-foreground">Bucket:</strong>{" "}
                    {uploadResult.bucket}
                  </p>
                  <p className="break-all">
                    <strong className="text-foreground">Key:</strong>{" "}
                    {uploadResult.key}
                  </p>
                  {uploadResult.url && (
                    <div className="mt-2 space-y-2">
                      <p className="break-all">
                        <strong className="text-foreground">URL:</strong>{" "}
                        <a
                          href={uploadResult.url}
                          target="_blank"
                          rel="noreferrer"
                          title={uploadResult.url}
                          className="text-primary hover:underline"
                        >
                          {uploadResult.url.length > 50
                            ? `${uploadResult.url.slice(0, 40)}...${uploadResult.url.slice(-10)}`
                            : uploadResult.url}
                        </a>
                      </p>
                      <audio
                        controls
                        src={uploadResult.url}
                        className="w-full h-10 mt-2"
                      />
                    </div>
                  )}
                </div>

                {processedUploadResult && (
                  <div className="pt-4 border-t border-border">
                    <h4 className="font-semibold text-foreground mb-2 text-sm">
                      Watermarked Output
                    </h4>
                    <p>
                      <strong className="text-foreground">Bucket:</strong>{" "}
                      {processedUploadResult.bucket}
                    </p>
                    <p className="break-all">
                      <strong className="text-foreground">Key:</strong>{" "}
                      {processedUploadResult.key}
                    </p>
                    {processedUploadResult.url && (
                      <div className="mt-2 space-y-2">
                        <p className="break-all">
                          <strong className="text-foreground">URL:</strong>{" "}
                          <a
                            href={processedUploadResult.url}
                            target="_blank"
                            rel="noreferrer"
                            title={processedUploadResult.url}
                            className="text-primary hover:underline"
                          >
                            {processedUploadResult.url.length > 50
                              ? `${processedUploadResult.url.slice(0, 40)}...${processedUploadResult.url.slice(-10)}`
                              : processedUploadResult.url}
                          </a>
                        </p>
                        <audio
                          controls
                          src={processedUploadResult.url}
                          className="w-full h-10 mt-2"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
