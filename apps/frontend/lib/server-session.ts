import "server-only";

type SessionResponse = {
  session: {
    id: string;
    userId: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getServerSession(cookieHeader?: string | null) {
  const response = await fetch(`${apiBaseUrl}/api/auth/get-session`, {
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SessionResponse | null;
}
