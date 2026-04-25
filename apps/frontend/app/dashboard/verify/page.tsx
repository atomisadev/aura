"use client";

import { useState } from "react";
import {
  FileAudio,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search,
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

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    detected: boolean;
    message?: string;
  } | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus(
        "Error: Select an audio file before starting the verification.",
      );
      return;
    }

    setIsVerifying(true);
    setStatus("Scanning for AURA tags...");
    setVerificationResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Note: Endpoint changed to /decode for verification logic
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decode`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      console.log(data);

      if (res.ok) {
        // Based on the python response: {"message": message, "task_id": task_id}
        const hasTag =
          data.message !== null &&
          data.message !== undefined &&
          data.message == "AURA decoded value A from file.";
        setVerificationResult({
          detected: hasTag,
          message: data.message,
        });
        setStatus(
          hasTag
            ? "AURA watermark detected successfully!"
            : "Scan complete: No AURA watermark found.",
        );
      } else {
        setStatus(`Error: ${data.message || "Verification failed"}`);
      }
    } catch (e) {
      console.error(e);
      setStatus(`Error: Verification failed to connect to the server: ${e}`);
    } finally {
      setIsVerifying(false);
      setFile(null);
    }
  };

  return (
    <section className="mx-auto flex h-fit w-full max-w-3xl flex-col gap-6 pb-20">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle>Verify Audio File</CardTitle>
          </div>
          <CardDescription>
            Verifies if an audio file is tagged by AURA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Search className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Deep Scan Technology</p>
              <p className="text-sm text-muted-foreground">
                Upload any audio track to verify its origin. Our system will
                scan for inaudible cryptographic tags associated with your AURA
                workspace.
              </p>
            </div>
          </div>

          <form onSubmit={verify} className="flex flex-col gap-4">
            <Label htmlFor="verify-file" className="sr-only">
              Audio file
            </Label>
            <Input
              id="verify-file"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setStatus(null);
                setVerificationResult(null);
              }}
            />

            <label
              htmlFor="verify-file"
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
                      ? "Ready to verify. Click to replace."
                      : "Click to select an audio file for verification."}
                  </p>
                </div>
              </div>
            </label>

            <Button
              type="submit"
              className="w-full"
              disabled={!file || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify AURA Tag"
              )}
            </Button>

            {status ? (
              <div
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                  status.startsWith("Error")
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : status.includes("detected successfully")
                      ? "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
                      : status.includes("Scan complete")
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-border bg-muted/40 text-foreground"
                }`}
              >
                {status.startsWith("Error") ? (
                  <AlertCircle className="size-4 shrink-0" />
                ) : status.includes("detected") ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : status.includes("Scan complete") ? (
                  <ShieldCheck className="size-4 shrink-0" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                )}
                <p>{status.replace("Error: ", "")}</p>
              </div>
            ) : null}

            {verificationResult && (
              <div
                className={`mt-2 p-6 rounded-lg border flex flex-col items-center justify-center text-center gap-4 ${
                  verificationResult.detected
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-muted/30 border-border"
                }`}
              >
                <div
                  className={`p-3 rounded-full ${
                    verificationResult.detected
                      ? "bg-green-500/10 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ShieldCheck className="size-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {verificationResult.detected
                      ? "AURA Watermark Found"
                      : "No AURA Watermark Detected"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    {verificationResult.detected
                      ? `This file was successfully identified as an authentic AURA-protected asset.${verificationResult.message ? ` Tag data: ${verificationResult.message}` : ""}`
                      : "This file does not contain a recognizable AURA watermark tag. It may be an original source or from an external system."}
                  </p>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
