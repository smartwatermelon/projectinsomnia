import type { Config } from "@netlify/functions"
import pendingPublications from "./scheduled-publications.json"
import { hasDuePublication } from "../../scripts/scheduled-publications.mjs"

export default async () => {
  if (!hasDuePublication(pendingPublications, new Date())) {
    return new Response("No scheduled publications are due")
  }

  const hook = Netlify.env.get("BUILD_HOOK_URL")
  if (!hook) throw new Error("BUILD_HOOK_URL not set")
  const response = await fetch(hook, { method: "POST" })
  if (!response.ok) throw new Error(`Build hook failed with status ${response.status}`)
  return new Response("Build triggered")
}

export const config: Config = {
  schedule: "0 13 * * *",
}
