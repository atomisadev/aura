"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/eden";

type DashboardSession = {
  session: {
    id: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};

type Resource = {
  id: string;
  name: string;
  createdAt: string;
};

const formatCreatedAt = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function DashboardClient({
  initialSession,
}: {
  initialSession: DashboardSession;
}) {
  const router = useRouter();
  const [newResourceName, setNewResourceName] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [resourceMessage, setResourceMessage] = useState<string | null>(null);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isSavingResource, setIsSavingResource] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    setIsLoadingResources(true);
    setResourceMessage(null);

    void api.resources.get().then((response) => {
      if (isCancelled) {
        return;
      }

      if (response.error) {
        setResourceMessage("Could not load your resources.");
        setResources([]);
        setRenameDrafts({});
        setIsLoadingResources(false);
        return;
      }

      const nextResources = response.data.resources;

      startTransition(() => {
        setResources(nextResources);
        setRenameDrafts(
          Object.fromEntries(
            nextResources.map((resource) => [resource.id, resource.name]),
          ),
        );
      });
      setIsLoadingResources(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };

  const createResource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newResourceName.trim();
    if (!trimmedName) {
      setResourceMessage("Resource name is required.");
      return;
    }

    setIsSavingResource(true);
    setResourceMessage(null);

    const response = await api.resources.post({
      name: trimmedName,
    });

    if (response.error) {
      setResourceMessage("Could not create the resource.");
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

    if (!nextName) {
      setResourceMessage("Resource name is required.");
      return;
    }

    setIsSavingResource(true);
    setResourceMessage(null);

    const response = await api.resources({ id: resourceId }).patch({
      name: nextName,
    });

    if (response.error) {
      setResourceMessage("Could not rename the resource.");
      setIsSavingResource(false);
      return;
    }

    startTransition(() => {
      setResources((current) =>
        current.map((resource) =>
          resource.id === resourceId ? response.data.resource : resource,
        ),
      );
    });
    setIsSavingResource(false);
  };

  const deleteResource = async (resourceId: string) => {
    setIsSavingResource(true);
    setResourceMessage(null);

    const response = await api.resources({ id: resourceId }).delete();

    if (response.error) {
      setResourceMessage("Could not delete the resource.");
      setIsSavingResource(false);
      return;
    }

    startTransition(() => {
      setResources((current) =>
        current.filter((resource) => resource.id !== resourceId),
      );
      setRenameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[resourceId];
        return nextDrafts;
      });
    });
    setIsSavingResource(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_45%,_#cbd5e1_100%)] px-6 py-10 text-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 text-white shadow-[0_32px_120px_-48px_rgba(15,23,42,0.85)]">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Protected dashboard
              </span>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Your resources live behind the same session the backend
                  enforces.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  This route only renders after the frontend validates your
                  Better Auth session and the backend continues to scope every
                  resource query by your authenticated user id.
                </p>
              </div>
            </div>

            <section className="rounded-[1.75rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                    Active session
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {initialSession.user.name}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {initialSession.user.email}
                  </p>
                </div>
                <dl className="grid gap-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <dt className="font-medium text-slate-500">User id</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-900">
                      {initialSession.user.id}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <dt className="font-medium text-slate-500">Session id</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-900">
                      {initialSession.session.id}
                    </dd>
                  </div>
                </dl>
                <button
                  className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => {
                    void signOut();
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <article className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                Route protection
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">
                `/dashboard` requires a valid backend session
              </h2>
              <p className="text-sm leading-7 text-slate-600">
                Unauthenticated requests are redirected back to the landing
                page before the dashboard renders. Direct visits and OAuth
                returns both end up here when the session is valid.
              </p>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                    Personal resources
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Your backend-only data
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {resources.length} total
                </span>
              </div>

              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => void createResource(event)}
              >
                <input
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-cyan-500 focus:bg-white"
                  onChange={(event) => setNewResourceName(event.target.value)}
                  placeholder="Quarterly roadmap"
                  value={newResourceName}
                />
                <button
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSavingResource}
                  type="submit"
                >
                  Add resource
                </button>
              </form>

              {resourceMessage ? (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {resourceMessage}
                </p>
              ) : null}

              {isLoadingResources ? (
                <p className="text-sm text-slate-500">Loading resources...</p>
              ) : resources.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  No resources yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <div
                      className="rounded-[1.5rem] border border-slate-200 bg-white p-4"
                      key={resource.id}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:bg-white"
                            onChange={(event) =>
                              setRenameDrafts((current) => ({
                                ...current,
                                [resource.id]: event.target.value,
                              }))
                            }
                            value={renameDrafts[resource.id] ?? ""}
                          />
                          <p className="text-xs text-slate-500">
                            Created {formatCreatedAt(resource.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                            onClick={() => {
                              void renameResource(resource.id);
                            }}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50"
                            onClick={() => {
                              void deleteResource(resource.id);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
