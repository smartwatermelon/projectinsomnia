import type { Config } from "@netlify/functions";

const MAX_ITEMS = 10;

export default async function handler(): Promise<Response> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("strava-feed: missing required environment variables");
    return Response.json({ items: [] }, { status: 502 });
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      console.error(
        `strava-feed: token exchange failed: ${tokenRes.status} ${tokenRes.statusText}`
      );
      return Response.json({ items: [] }, { status: 502 });
    }

    const { access_token, refresh_token: newRefreshToken } = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    if (newRefreshToken && newRefreshToken !== refreshToken) {
      console.warn(
        "strava-feed: Strava issued a new refresh token — update STRAVA_REFRESH_TOKEN env var to avoid auth failure"
      );
    }

    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${MAX_ITEMS}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!activitiesRes.ok) {
      console.error(
        `strava-feed: activities fetch failed: ${activitiesRes.status} ${activitiesRes.statusText}`
      );
      return Response.json({ items: [] }, { status: 502 });
    }

    const activities = (await activitiesRes.json()) as Array<{
      id: number;
      name: string;
      type: string;
      start_date: string;
    }>;

    const items = activities.map((a) => ({
      name: a.name,
      type: a.type,
      startDate: a.start_date,
      link: `https://www.strava.com/activities/${a.id}`,
    }));

    return Response.json(
      { items },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error(
      `strava-feed: error: ${e instanceof Error ? e.message : String(e)}`
    );
    return Response.json({ items: [] }, { status: 502 });
  }
}

export const config: Config = {
  path: "/api/strava-feed",
};
