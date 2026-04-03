import type { Config } from "@netlify/functions"

export default async () => {
  const hook = Netlify.env.get("BUILD_HOOK_URL")
  if (!hook) throw new Error("BUILD_HOOK_URL not set")
  await fetch(hook, { method: "POST" })
  return new Response("Build triggered")
}

export const config: Config = {
  schedule: "0 13 * * *",
}
