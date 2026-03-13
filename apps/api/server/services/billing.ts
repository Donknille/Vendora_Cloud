import { createClient } from "@supabase/supabase-js";
import {
  mapUserRecordToSubscriptionState,
  users,
} from "@vendora/shared";
import { eq } from "drizzle-orm";

import type { AuthenticatedUser } from "../middleware/auth";
import { db } from "../db";

const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com/v1";

type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  billing_issue_detected_at?: string | null;
  unsubscribe_detected_at?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement | undefined>;
  };
};

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_ADMIN_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getRevenueCatConfig() {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;

  if (!secretKey) {
    throw new Error("REVENUECAT_CONFIG_MISSING");
  }

  return {
    secretKey,
    entitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || "pro",
  };
}

async function loadUserRecord(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.supabase_id, userId));

  return user ?? null;
}

export async function ensureUserRecord(authenticatedUser: AuthenticatedUser) {
  const email = authenticatedUser.email;
  if (!email) {
    throw new Error("Missing authenticated email.");
  }

  await db
    .insert(users)
    .values({
      supabase_id: authenticatedUser.userId,
      email,
      revenuecat_app_user_id: authenticatedUser.userId,
      subscription_status: "trialing",
      created_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: users.supabase_id,
      set: {
        email,
        revenuecat_app_user_id: authenticatedUser.userId,
      },
    });

  const user = await loadUserRecord(authenticatedUser.userId);
  if (!user) {
    throw new Error("User sync failed.");
  }

  const patch: {
    subscription_status?: string;
    created_at?: string;
    revenuecat_app_user_id?: string;
  } = {};

  if (!user.subscription_status) {
    patch.subscription_status = "trialing";
  }
  if (!user.created_at) {
    patch.created_at = new Date().toISOString();
  }
  if (!user.revenuecat_app_user_id) {
    patch.revenuecat_app_user_id = authenticatedUser.userId;
  }

  if (Object.keys(patch).length > 0) {
    await db
      .update(users)
      .set(patch)
      .where(eq(users.supabase_id, authenticatedUser.userId));

    const refreshedUser = await loadUserRecord(authenticatedUser.userId);
    if (!refreshedUser) {
      throw new Error("User sync failed.");
    }

    return refreshedUser;
  }

  return user;
}

export async function getSubscriptionStateForAuthenticatedUser(
  authenticatedUser: AuthenticatedUser,
) {
  const user = await ensureUserRecord(authenticatedUser);
  return {
    user,
    subscriptionState: mapUserRecordToSubscriptionState(user),
  };
}

async function fetchRevenueCatEntitlement(appUserId: string) {
  const { secretKey, entitlementId } = getRevenueCatConfig();
  const response = await fetch(
    `${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `RevenueCat lookup failed (${response.status}): ${details.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as RevenueCatSubscriberResponse;
  return payload.subscriber?.entitlements?.[entitlementId] ?? null;
}

function getRevenueCatStatusFromEntitlement(
  entitlement: RevenueCatEntitlement | null,
) {
  const expiresAt =
    entitlement?.grace_period_expires_date ??
    entitlement?.expires_date ??
    null;

  if (!entitlement) {
    return {
      status: "expired" as const,
      subscriptionExpiresAt: null,
    };
  }

  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const hasAccess =
    !expiresAtDate || Number.isNaN(expiresAtDate.getTime())
      ? true
      : expiresAtDate.getTime() > Date.now();

  if (!hasAccess) {
    return {
      status: "expired" as const,
      subscriptionExpiresAt: expiresAt,
    };
  }

  if (entitlement.billing_issue_detected_at) {
    return {
      status: "past_due" as const,
      subscriptionExpiresAt: expiresAt,
    };
  }

  if (entitlement.unsubscribe_detected_at) {
    return {
      status: "canceled" as const,
      subscriptionExpiresAt: expiresAt,
    };
  }

  return {
    status: "active" as const,
    subscriptionExpiresAt: expiresAt,
  };
}

export async function refreshSubscriptionStateForUser(userId: string) {
  const user = await loadUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const appUserId = user.revenuecat_app_user_id ?? user.supabase_id;
  if (!appUserId) {
    throw new Error("RevenueCat app user id is missing.");
  }

  const entitlement = await fetchRevenueCatEntitlement(appUserId);
  const nextStatus = getRevenueCatStatusFromEntitlement(entitlement);

  await db
    .update(users)
    .set({
      revenuecat_app_user_id: appUserId,
      subscription_status: nextStatus.status,
      subscription_expires_at: nextStatus.subscriptionExpiresAt,
    })
    .where(eq(users.supabase_id, userId));

  const updatedUser = await loadUserRecord(userId);
  if (!updatedUser) {
    throw new Error("User not found.");
  }

  return mapUserRecordToSubscriptionState(updatedUser);
}

async function deleteRevenueCatSubscriber(appUserId: string) {
  const { secretKey } = getRevenueCatConfig();
  const response = await fetch(
    `${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `RevenueCat delete failed (${response.status}): ${details.slice(0, 200)}`,
    );
  }
}

export async function deleteAccount(authenticatedUser: AuthenticatedUser) {
  const user = await ensureUserRecord(authenticatedUser);
  const revenueCatAppUserId =
    user.revenuecat_app_user_id ?? authenticatedUser.userId;

  await deleteRevenueCatSubscriber(revenueCatAppUserId);

  const supabaseAdmin = getSupabaseAdminClient();
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
    authenticatedUser.userId,
  );

  if (authDeleteError) {
    throw authDeleteError;
  }

  await db
    .delete(users)
    .where(eq(users.supabase_id, authenticatedUser.userId));
}
