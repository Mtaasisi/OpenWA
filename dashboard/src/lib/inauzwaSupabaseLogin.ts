type SupabaseTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  user?: { id?: string; email?: string };
};

type SupabaseUserRow = {
  branch_id?: string | null;
  vendor_id?: string | null;
  full_name?: string | null;
};

export type InauzwaSupabaseLoginResult = {
  accessToken: string;
  email: string;
  userId: string | null;
  branchId: string | null;
  vendorId: string | null;
  fullName: string | null;
};

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

export async function signInToInauzwaSupabase(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<InauzwaSupabaseLoginResult> {
  const baseUrl = normalizeSupabaseUrl(supabaseUrl);
  const tokenRes = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  let tokenBody: SupabaseTokenResponse = {};
  try {
    tokenBody = (await tokenRes.json()) as SupabaseTokenResponse;
  } catch {
    tokenBody = {};
  }

  if (!tokenRes.ok || !tokenBody.access_token) {
    const detail =
      tokenBody.error_description ||
      tokenBody.error ||
      `Supabase auth failed (HTTP ${tokenRes.status})`;
    throw new Error(detail);
  }

  const accessToken = tokenBody.access_token;
  const userId = tokenBody.user?.id ?? null;
  let branchId: string | null = null;
  let vendorId: string | null = null;
  let fullName: string | null = null;

  if (userId) {
    const profileRes = await fetch(
      `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=branch_id,vendor_id,full_name&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (profileRes.ok) {
      const rows = (await profileRes.json()) as SupabaseUserRow[];
      if (rows[0]) {
        branchId = rows[0].branch_id?.trim() || null;
        vendorId = rows[0].vendor_id?.trim() || null;
        fullName = rows[0].full_name?.trim() || null;
      }
    }
  }

  const productProbe = branchId
    ? `${baseUrl}/rest/v1/lats_products?branch_id=eq.${encodeURIComponent(branchId)}&select=id&limit=1`
    : `${baseUrl}/rest/v1/lats_products?select=id&limit=1`;
  const verify = await fetch(productProbe, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!verify.ok) {
    throw new Error(
      `Signed in, but inventory access failed (HTTP ${verify.status}). Check branch assignment.`,
    );
  }

  return {
    accessToken,
    email: email.trim().toLowerCase(),
    userId,
    branchId,
    vendorId,
    fullName,
  };
}
