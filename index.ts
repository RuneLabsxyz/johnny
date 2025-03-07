import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChromaVectorStore, discord } from "../fork/daydreams/packages/core/src/extensions";
import { createGroq } from "@ai-sdk/groq";
import { character } from "./characters/quain";
import { z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./twitter/twitter";

let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const agent = createDreams({
  logger: LogLevel.TRACE,
  model: openrouter("google/gemini-2.0-flash-001"),
  extensions: [twitter, discord],
  character: character,
  memory: {
    store: createMemoryStore(),
    vector: createChromaVectorStore("agent", "http://localhost:8000"),
    vectorModel: openrouter("google/gemini-2.0-flash-001"),
  },
  inputs: {"consciousness": consciousness}
});

// Start the agent
await agent.start();
