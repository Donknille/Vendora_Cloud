import type { NextFunction, Request, Response } from "express";

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  token: string;
}

type SupabaseUserResponse = {
  id: string;
  email?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseApiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseApiKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    supabaseApiKey,
  };
}

async function loadSupabaseUser(
  token: string,
): Promise<SupabaseUserResponse> {
  const { supabaseUrl, supabaseApiKey } = getSupabaseConfig();

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseApiKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("INVALID_TOKEN");
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `SUPABASE_AUTH_FAILED:${response.status}:${details.slice(0, 200)}`,
    );
  }

  const user = (await response.json()) as SupabaseUserResponse;
  if (!user?.id) {
    throw new Error("INVALID_TOKEN");
  }

  return user;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header." });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  try {
    const user = await loadSupabaseUser(token);
    req.auth = {
      userId: user.id,
      email: typeof user.email === "string" ? user.email : undefined,
      token,
    };
    return next();
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TOKEN") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    if (
      error instanceof Error &&
      error.message === "SUPABASE_CONFIG_MISSING"
    ) {
      console.error("Supabase auth config missing.", error);
      return res.status(500).json({
        error: "Server auth configuration is incomplete.",
      });
    }

    console.error("JWT verification failed.", error);
    return res.status(500).json({ error: "Failed to verify session." });
  }
}

export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!req.auth) {
    throw new Error("Authenticated user context is missing.");
  }

  return req.auth;
}
