"use client";

import { useState } from "react";

export function AudioUploader() {
  const [file, setFile] = useState<File | null>(null):

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();

    alert(res.ok ? `Uploaded: ${data.upload.key}` : `Error: ${data.message}`)
  };

  return (
      <form onSubmit={upload} className="space-y-2">
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button type="submit" className="px-4 py-2 bg-slate-950 text-white rounded">
          Upload to B2
        </button>
      </form>
  );
}
