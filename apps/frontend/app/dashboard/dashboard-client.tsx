"use client";

import { startTransition, useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "@/lib/eden";
import { AuraLogo } from "@/components/aura-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadCloud, Plus, FileAudio } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSession = {
  session: { id: string };
  user: { id: string; email: string; name: string; image?: string | null };
};

type Resource = {
  id: string;
  name: string;
  createdAt: Date;
};

type UploadResult = {
  bucket: string;
  key: string;
  url: string | null;
};

const formatCreatedAt = (value: Date | string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function DashboardClient({
  initialSession,
}: {
  initialSession: DashboardSession;
}) {
  const [newResourceName, setNewResourceName] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [resourceMessage, setResourceMessage] = useState<string | null>(null);

  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [processedUploadResult, setProcessedUploadResult] =
    useState<UploadResult | null>(null);

  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsLoadingResources(true);
    setResourceMessage(null);

    void api.resources.get().then((response) => {
      if (isCancelled) return;

      if (response.error) {
        setResourceMessage("Failed to load encoding presets.");
        setResources([]);
        setIsLoadingResources(false);
        return;
      }

      const nextResources = response.data.resources;
      startTransition(() => {
        setResources(nextResources);
        setRenameDrafts(
          Object.fromEntries(nextResources.map((r) => [r.id, r.name])),
        );
      });
      setIsLoadingResources(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // React Dropzone Setup
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedAudioFile(acceptedFiles[0]);
      setUploadMessage(null);
      setUploadResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".flac", ".m4a", ".aac"],
    },
    maxFiles: 1,
  });

  const uploadAudio = async () => {
    if (!selectedAudioFile) {
      setUploadMessage("Please select an audio file to encode.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedAudioFile);

    setIsUploadingAudio(true);
    setUploadMessage(null);
    setUploadResult(null);
    setProcessedUploadResult(null);

    const response = await fetch(`${apiBaseUrl}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as
      | { upload: UploadResult; processedUpload?: UploadResult }
      | { message: string };

    if (!response.ok || !("upload" in payload)) {
      setUploadMessage(
        "message" in payload ? payload.message : "Encoding failed.",
      );
      setIsUploadingAudio(false);
      return;
    }

    setUploadResult(payload.upload);
    if (payload.processedUpload) {
      setProcessedUploadResult(payload.processedUpload);
    }
    setUploadMessage("Audio watermarked and secured successfully.");
    setSelectedAudioFile(null);
    setIsUploadingAudio(false);
  };

  const createResource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newResourceName.trim();
    if (!trimmedName) return;

    setIsSavingResource(true);
    setResourceMessage(null);

    const response = await api.resources.post({ name: trimmedName });

    if (response.error) {
      setResourceMessage("Could not create preset.");
      setIsSavingResource(false);
      return;
    }

    startTransition(() => {
      setResources((current) => [response.data.resource, ...current]);
      setRenameDrafts((current) => ({
        ...current,
        [response.data.resource.id]: response.data.resource.name,
      }));
      setNewResourceName("");
    });
    setIsSavingResource(false);
  };

  const renameResource = async (resourceId: string) => {
    const nextName = renameDrafts[resourceId]?.trim();
    if (!nextName) return;

    setIsSavingResource(true);
    const response = await api.resources({ id: resourceId }).patch({
      name: nextName,
    });

    if (!response.error) {
      startTransition(() => {
        setResources((current) =>
          current.map((r) =>
            r.id === resourceId ? response.data.resource : r,
          ),
        );
      });
    }
    setIsSavingResource(false);
  };

  const deleteResource = async (resourceId: string) => {
    setIsSavingResource(true);
    const response = await api.resources({ id: resourceId }).delete();

    if (!response.error) {
      startTransition(() => {
        setResources((current) => current.filter((r) => r.id !== resourceId));
        setRenameDrafts((current) => {
          const nextDrafts = { ...current };
          delete nextDrafts[resourceId];
          return nextDrafts;
        });
      });
    }
    setIsSavingResource(false);
  };

  return (
    <div className="w-full max-w-5xl grid gap-8 md:grid-cols-2 items-start">
      {/* Encoder Panel */}
      <Card className="shadow-lg border-muted">
        <CardHeader>
          <div className="mb-1 flex items-center gap-3">
            <AuraLogo className="w-28 text-foreground" />
            <CardTitle>Encoder</CardTitle>
          </div>
          <CardDescription>
            Secure your audio with an inaudible cryptographic watermark.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Drag and Drop Zone */}
            <div
              {...getRootProps()}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <input {...getInputProps()} />
              <UploadCloud
                className={cn(
                  "mb-4 size-10 transition-colors",
                  isDragActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              {selectedAudioFile ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileAudio className="size-4" />
                    {selectedAudioFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click or drag to replace
                  </p>
                </div>
              ) : isDragActive ? (
                <p className="text-sm font-medium text-primary">
                  Drop the audio file here ...
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop an audio file here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse from your computer
                  </p>
                </div>
              )}
            </div>

            <Button
              className="w-full font-semibold h-11"
              disabled={isUploadingAudio || !selectedAudioFile}
              onClick={uploadAudio}
            >
              {isUploadingAudio ? "Encoding Audio..." : "Encode & Secure Asset"}
            </Button>
          </div>

          {uploadMessage && (
            <p className="mt-6 text-sm text-center font-medium text-primary">
              {uploadMessage}
            </p>
          )}

          {uploadResult && (
            <div className="mt-6 space-y-4 text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg border">
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
                        className="text-primary hover:underline"
                      >
                        {uploadResult.url}
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
                          className="text-primary hover:underline"
                        >
                          {processedUploadResult.url}
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
        </CardContent>
      </Card>

      {/* Presets / Resources Panel */}
      <Card className="shadow-lg border-muted">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Encoding Presets</CardTitle>
              <CardDescription>
                Manage your custom watermark settings
              </CardDescription>
            </div>
            <div className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
              {resources.length} Active
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="flex gap-3" onSubmit={(e) => void createResource(e)}>
            <Input
              placeholder="e.g., Podcast Intro Profile"
              value={newResourceName}
              onChange={(e) => setNewResourceName(e.target.value)}
              className="h-10"
            />
            <Button
              type="submit"
              disabled={isSavingResource}
              className="h-10 px-4"
            >
              <Plus className="size-4" />
            </Button>
          </form>

          {resourceMessage && (
            <p className="text-sm text-destructive">{resourceMessage}</p>
          )}

          <div className="space-y-3 pt-2">
            {isLoadingResources ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading presets...
              </p>
            ) : resources.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground bg-muted/20">
                No presets created yet.
              </div>
            ) : (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="rounded-lg border bg-card/50 p-3 flex flex-col gap-3 sm:flex-row sm:items-center transition-colors hover:bg-card"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input
                      value={renameDrafts[resource.id] ?? ""}
                      className="h-8 border-transparent bg-transparent px-2 hover:border-border focus:border-border focus:bg-background"
                      onChange={(e) =>
                        setRenameDrafts((current) => ({
                          ...current,
                          [resource.id]: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">
                      Created {formatCreatedAt(resource.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void renameResource(resource.id);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        void deleteResource(resource.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
