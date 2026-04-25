"use client";

import { useState } from "react";
import { FileAudio, UploadCloud } from "lucide-react";
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

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("Choose an audio file before starting the upload.");
      return;
    }

    setIsUploading(true);
    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      setStatus(
        res.ok ? `Success! Key: ${data.upload.key}` : `Error: ${data.message}`,
      );
    } catch {
      setStatus("Upload failed to connect to the server.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Audio Upload</CardTitle>
          <CardDescription>
            Send a source file into the Aura pipeline without leaving the
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Ready for a single audio file</p>
              <p className="text-sm text-muted-foreground">
                Supported by your browser file picker. Start with one track and
                the upload will be sent to the backend immediately.
              </p>
            </div>
          </div>

          <form onSubmit={upload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audio-file">Audio file</Label>
              <Input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setStatus(null);
                }}
              />
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileAudio className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {file ? file.name : "No file selected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {file
                      ? "Ready to upload."
                      : "Select an audio file to enable the action."}
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!file || isUploading}>
              {isUploading ? "Uploading..." : "Upload audio"}
            </Button>

            {status ? (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                {status}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
