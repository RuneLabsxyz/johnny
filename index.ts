import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChromaVectorStore } from "../fork/daydreams/packages/chroma/src";
import { createGroq } from "@ai-sdk/groq";
import { personality } from "./characters/ponzius";
import { z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./extensions/twitter/twitter";
import { get_balances } from "./extensions/ponziland/actions/get-balances";
import { StarknetChain } from "../fork/daydreams/packages/defai/src";
import { orchard } from "./extensions/orchard";
import { ponziland } from "./extensions/ponziland/ponziland";
import { discord } from "./extensions/discord";
import { Logger } from "../fork/daydreams/packages/core/src";
import { env } from "env";
import { ChromaClient, GoogleGenerativeAiEmbeddingFunction } from "chromadb";


let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});


console.log(env);
const chain = new StarknetChain({rpcUrl: env.STARKNET_RPC_URL ?? "", 
                                  address: env.STARKNET_ADDRESS ?? "",
                                  privateKey: env.STARKNET_PRIVATE_KEY ?? "" 
})

const logger = new Logger({
  level: LogLevel.ERROR,
});

let c = consciousness("Give me a brief thought you want to share on social media considering the following character information: " + personality + `don't make the post itself, just give the general topic or idea. You are giving the instruction for someone else to write the tweet itself. Only give 1 and make it conscise and coherent about a single thing. DO NOT INCLUDE HASHTAGS EVER `)

const agent = createDreams({
  logger: logger,
  model: openrouter("google/gemini-2.0-flash-001"),
  extensions: [discord, 
    //twitter, 
    ponziland(chain)
    ],
  memory: {
    store: createMemoryStore(),
    vector: createChromaVectorStore("agent", "http://localhost:8000", new GoogleGenerativeAiEmbeddingFunction({
      apiKey: process.env.GOOGLE_API_KEY!,
    })),
    vectorModel: openrouter("google/gemini-2.0-flash-001"),
  },
  inputs: {
    consciousness: c,
  },
  streaming: false,
}); 

// Start the agent
await agent.start();
