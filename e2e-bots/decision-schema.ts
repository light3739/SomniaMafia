/**
 * Validation + deterministic fallback for agent LLM decisions.
 *
 * The LLM is constrained by `inferString.allowedValues` to one of the alive
 * addresses, but we still need a safety net:
 *   - the response might not parse as an address (validator failure mode);
 *   - the agent might be a wallet we want to exclude (self-vote, etc.);
 *   - the LLM might fail entirely (status != Success).
 *
 * Fallback policy is intentionally simple. The deterministic order means two
 * separate runs of the spike with the same room state pick the same target,
 * so the on-chain footprint is reproducible for the demo.
 */
import { getAddress, type Address } from "viem";

export type Action = "vote" | "kill" | "heal" | "check" | "skip";

export interface DecisionContext {
  /** Agent wallet making the decision. Excluded from "vote for someone else" actions. */
  self: Address;
  /** Currently alive players (lowercase OK — we normalise). */
  alive: Address[];
  /** Action the agent is asked to take. */
  action: Action;
}

export interface DecisionResult {
  target: Address;
  /** "llm" if LLM picked a valid target, "fallback" if we synthesised one. */
  source: "llm" | "fallback";
  /** Reason for fallback — useful for logs/telemetry. */
  fallbackReason?: string;
}

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function normalise(addrs: Address[]): Address[] {
  return addrs
    .map((a) => {
      try { return getAddress(a); } catch { return ZERO; }
    })
    .filter((a) => a !== ZERO);
}

/**
 * Parse LLM string into an address. Tolerates:
 *   - leading/trailing whitespace, quotes, code fences
 *   - JSON wrapping  `{ "target": "0x..." }`
 *   - extra commentary around the address
 */
export function parseAddressFromLLM(raw: string): Address | null {
  if (!raw) return null;
  const hex = raw.match(/0x[a-fA-F0-9]{40}/);
  if (!hex) return null;
  try { return getAddress(hex[0]); } catch { return null; }
}

/**
 * Resolve a decision: parse LLM, validate against alive list, fall back if
 * invalid. Never returns ZERO; throws if no valid target exists.
 */
export function resolveDecision(
  llmResponse: string | null,
  ctx: DecisionContext
): DecisionResult {
  const alive = normalise(ctx.alive);
  const self = (() => { try { return getAddress(ctx.self); } catch { return ZERO; } })();
  const excludeSelf = ctx.action === "vote" || ctx.action === "kill" || ctx.action === "check";
  const pool = alive.filter((a) => !excludeSelf || a !== self);

  if (pool.length === 0) {
    throw new Error(`No valid targets for action ${ctx.action} (alive=${alive.length}, self=${self})`);
  }

  // 1. Try LLM response
  if (llmResponse) {
    const parsed = parseAddressFromLLM(llmResponse);
    if (parsed && pool.some((a) => a === parsed)) {
      return { target: parsed, source: "llm" };
    }
    return {
      target: deterministicPick(pool),
      source: "fallback",
      fallbackReason: parsed
        ? `parsed=${parsed} not in alive pool (${pool.length})`
        : `LLM response did not contain an address: ${JSON.stringify(llmResponse.slice(0, 80))}`,
    };
  }

  // 2. No response at all
  return {
    target: deterministicPick(pool),
    source: "fallback",
    fallbackReason: "no LLM response (timeout / failed status)",
  };
}

/** Lowest address wins. Stable across re-runs without RNG state. */
function deterministicPick(pool: Address[]): Address {
  return [...pool].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))[0];
}

/** Build the prompt+allowedValues pair that the LLM will see. Centralised so prompts stay consistent. */
export function buildVotePrompt(args: {
  self: Address;
  alive: Address[];
  publicChat: { from: Address; text: string }[];
  dayCount: number;
  language?: string;
}): { prompt: string; system: string; allowedValues: string[] } {
  const lang = args.language ?? "English";
  const others = normalise(args.alive).filter((a) => a !== args.self);
  const chatLines = args.publicChat
    .slice(-15) // keep prompt tight
    .map((m) => `${m.from.slice(0, 6)}…: ${m.text}`)
    .join("\n");

  return {
    system: [
      `You are a player in an on-chain Mafia game. Your wallet is ${args.self}.`,
      `Decide who to vote out today. Respond with EXACTLY one wallet address from the allowed list — no commentary, no prose.`,
      `If unsure, pick the most suspicious player based on the public chat. Never vote for yourself.`,
      `Reply language: ${lang}.`,
    ].join(" "),
    prompt: [
      `Day ${args.dayCount}.`,
      `Alive players (not you): ${others.join(", ")}`,
      `Recent public chat:`,
      chatLines || "(no messages yet)",
      ``,
      `Reply with one address from the allowed list. Address only.`,
    ].join("\n"),
    allowedValues: others, // Somnia LLM Inference constrains output to this set
  };
}
