"use client";

import { useState } from "react";
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
    if (!file) return;

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
    } catch (err) {
      setStatus("Upload failed to connect to the server.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Audio Uploader</CardTitle>
          <CardDescription>
            Upload audio directly to your Backblaze B2 bucket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={upload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audio-file">Select Audio File</Label>
              <Input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!file || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload to B2"}
            </Button>
            {status && (
              <p className="text-sm font-medium text-center text-slate-600 mt-2">
                {status}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
