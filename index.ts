import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChromaVectorStore, discord } from "../fork/daydreams/packages/core/src/extensions";
import { createGroq } from "@ai-sdk/groq";
import { character } from "./characters/johnny";
import { z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./twitter/twitter";
import { get_balances } from "./actions/get-balances";
import { StarknetChain } from "../fork/daydreams/packages/core/src";

let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const chain = new StarknetChain({rpcUrl: process.env.STARKNET_RPC_URL ?? "", 
                                  address: process.env.STARKNET_ADDRESS ?? "",
                                  privateKey: process.env.STARKNET_PRIVATE_KEY ?? "" 
})

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
  inputs: {"consciousness": consciousness},
  actions: [get_balances(chain)]
}); 

// Start the agent
await agent.start();
