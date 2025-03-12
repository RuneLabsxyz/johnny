import { Action, createDreams, createMemoryStore, LogLevel, memory, action, ActionCall, input, formatXml, StarknetChain } from "../fork/daydreams/packages/core/src";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cli, createChromaVectorStore, discord } from "../fork/daydreams/packages/core/src/extensions";
import { createGroq } from "@ai-sdk/groq";
import { character } from "./characters/quain";
import { array, z } from "zod";
import { generateText } from "ai";
import { consciousness } from "./consciousness";
import { twitter } from "./twitter/twitter";
import { get_balances } from "./actions/get-balances";

let openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});


const chain = new StarknetChain({rpcUrl: process.env.STARKNET_RPC_URL ?? "", 
    address: process.env.STARKNET_ADDRESS ?? "",
    privateKey: process.env.STARKNET_PRIVATE_KEY ?? "" 
})

const execute_transactuon = action({
    name: "execute_transaction",
    description: "Execute a transaction on starknet",
    schema: z.object({
        calls: z.array(
            z.object({
                contractAddress: z
                    .string()
                    .describe(
                        "The address of the contract to execute the transaction on"
                    ),
                entrypoint: z
                    .string()
                    .describe("The entrypoint to call on the contract"),
                calldata: z
                    .array(z.union([z.number(), z.string()]))
                    .describe("The calldata to pass to the entrypoint. Remember for token values use wei values, so x10^18"),
        })
        .describe(
            "The payload to execute the call, never include slashes or comments"
        ),
    ).describe("Array of all calls to execute in transaction. Include all transactions here, instead of using this multiple times"),
    }),
    handler(call, ctx, agent) {

        console.log(call);

        return call;
    }
})


const agent = createDreams({
  logger: LogLevel.TRACE,
  model: openrouter("google/gemini-2.0-flash-001"),
  extensions: [cli],
  character: character,
  memory: {
    store: createMemoryStore(),
    vector: createChromaVectorStore("agent", "http://localhost:8000"),
    vectorModel: openrouter("google/gemini-2.0-flash-001"),
  },
  actions: [get_balances(chain), execute_transactuon]
});



// Start the agent
await agent.start();
