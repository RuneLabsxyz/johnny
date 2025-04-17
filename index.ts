import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChromaVectorStore } from "../fork/daydreams/packages/chroma/src";
import { createGroq } from "@ai-sdk/groq";
import { personality } from "./characters/ponzius";
import { z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./extensions/twitter/twitter";
import { get_balances } from "./actions/get-balances";
import { StarknetChain } from "../fork/daydreams/packages/defai/src";
import { orchard } from "./extensions/orchard";
import { ponziland } from "./extensions/ponziland";
import { discord } from "./extensions/discord";

let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const chain = new StarknetChain({rpcUrl: process.env.STARKNET_RPC_URL ?? "", 
                                  address: process.env.STARKNET_ADDRESS ?? "",
                                  privateKey: process.env.STARKNET_PRIVATE_KEY ?? "" 
})

let c = consciousness("Give me a random thought you want to share on social media considering the following character information: " + personality + `don't make the post itself, just give the general topic or idea. You are giving the instruction for someone else to write the tweet itself.`)

const agent = createDreams({
  logger: LogLevel.ERROR,
  model: openrouter("google/gemini-2.0-flash-001"),
  extensions: [discord, twitter, 
    ponziland(chain)
    ],
  memory: {
    store: createMemoryStore(),
    vector: createChromaVectorStore("agent", "http://localhost:8000"),
    vectorModel: openrouter("google/gemini-2.0-flash-001"),
  },
  inputs: {
    //consciousness: c,
  },
}); 

// Start the agent
await agent.start();
