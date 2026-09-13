/** Session counts describe browser visits, never verified people. No cross-site ID. */
export function track(
  event: "map_view" | "request_view" | "signin_start" | "signin_complete",
  entity = "",
) {
  try {
    let session = sessionStorage.getItem("spros-visit");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("spros-visit", session);
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, event, entity }),
    }).catch(() => {});
  } catch {
    /* Analytics never blocks the product, including private browsing. */
  }
}
