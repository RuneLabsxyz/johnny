import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChromaVectorStore, discord } from "../fork/daydreams/packages/core/src/extensions";
import { createGroq } from "@ai-sdk/groq";
import { character } from "./characters/johnny";
import { z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./extensions/twitter/twitter";
import { get_balances } from "./actions/get-balances";
import { StarknetChain } from "../fork/daydreams/packages/core/src";
import { ponziland } from "./extensions/ponziland";
import { orchard } from "./extensions/orchard";

let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const chain = new StarknetChain({rpcUrl: process.env.STARKNET_RPC_URL ?? "", 
                                  address: process.env.STARKNET_ADDRESS ?? "",
                                  privateKey: process.env.STARKNET_PRIVATE_KEY ?? "" 
})

let c = consciousness("Give me a random thought you want to share on social media considering the following character information: " + character + `don't make the post itself, just say something like "I want to tweet about x")`)

const agent = createDreams({
  logger: LogLevel.TRACE,
  model: openrouter("google/gemini-2.0-flash-001"),
  extensions: [discord, orchard(chain)],
  character: character,
  memory: {
    store: createMemoryStore(),
    vector: createChromaVectorStore("agent", "http://localhost:8000"),
    vectorModel: openrouter("google/gemini-2.0-flash-001"),
  },
 // inputs: {"consciousness": c},
}); 

// Start the agent
await agent.start();
