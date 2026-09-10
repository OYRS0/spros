import { z } from "zod";
import type { Dataset } from "@/lib/domain/types";
import { categorySchema } from "@/lib/domain/validation";
import { api } from "@/lib/client";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type Registry = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerSprosTools(actions: {
  getData: () => Dataset;
  filter: (v: { category?: string; search?: string }) => void;
  open: (id: string) => void;
  refresh: () => Promise<void>;
}) {
  const context = (document as Document & { modelContext?: Registry })
    .modelContext;
  if (!context?.registerTool) return;
  const life = new AbortController();
  const tools: Tool[] = [
    {
      name: "read_spros_requests",
      title: "Запросы SPROS",
      description:
        "Read the map's requests. All current numbers are demonstration data, not traction.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        z.object({}).strict().parse(input);
        return actions.getData().requests.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          location: r.location,
          votes: r.votes,
          isDemo: r.isDemo,
        }));
      },
    },
    {
      name: "filter_spros_map",
      title: "Фильтры карты",
      description:
        "Set the category or search filter in the visible map. Does not create records.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "all",
              "food",
              "coffee",
              "grocery",
              "sport",
              "kids",
              "pets",
              "beauty",
              "auto",
              "services",
              "fun",
              "other",
            ],
          },
          search: { type: "string", maxLength: 100 },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const p = z
          .object({
            category: z.union([z.literal("all"), categorySchema]).optional(),
            search: z.string().max(100).optional(),
          })
          .strict()
          .parse(input);
        actions.filter(p);
        return { applied: p };
      },
    },
    {
      name: "open_spros_request",
      title: "Открыть запрос",
      description: "Open the request card in the visible interface.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const p = z.object({ id: z.string() }).strict().parse(input);
        if (!actions.getData().requests.some((r) => r.id === p.id))
          throw new Error("Запрос не найден");
        actions.open(p.id);
        return { opened: p.id };
      },
    },
    {
      name: "support_spros_request",
      title: "Поддержать запрос",
      description:
        "Save one support vote for the signed-in user. Pledge is an optional statement of intention, never a payment. Updates an existing vote rather than adding a second one.",
      inputSchema: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          pledge: { type: "number", enum: [0, 1000, 5000, 15000, 50000] },
        },
        required: ["requestId", "pledge"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const p = z
          .object({
            requestId: z.string().min(1).max(100),
            pledge: z.union([
              z.literal(0),
              z.literal(1000),
              z.literal(5000),
              z.literal(15000),
              z.literal(50000),
            ]),
          })
          .strict()
          .parse(input);
        await api("/api/actions", { action: "support", ...p });
        await actions.refresh();
        return {
          saved: true,
          requestId: p.requestId,
          pledge: p.pledge,
          payment: false,
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: life.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
  }
  return () => life.abort();
}
