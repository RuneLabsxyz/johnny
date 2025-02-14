/**
 * Basic example demonstrating the Daydreams package functionality.
 * This example creates an interactive CLI agent that can:
 * - Execute tasks using the ChainOfThought system
 * - Interact with Starknet blockchain
 * - Query data via GraphQL
 * - Maintain conversation memory using ChromaDB
 */

import { LLMClient, ChainOfThought, ChromaVectorDB, Logger, Consciousness } from "../daydreams/packages/core/src";
import { CONTEXT, get_auctions_str, get_lands_str } from "./ponziland-context.ts";
import * as readline from "readline";
import chalk from "chalk";
import { z } from "zod";
import { Providers } from "../daydreams/packages/core/src";
import { Chains } from "../daydreams/packages/core/src";
import { Types } from "../daydreams/packages/core/src";
import { env } from "./env";
import { injectTags } from "../daydreams/packages/core/src/core/utils";
import { DiscordClient } from "../daydreams/packages/core/src/core/io/discord";
import { Contract, RpcProvider, type Abi } from "starknet";
import manifest from "./manifest.json";
import { ConversationManager } from "../daydreams/packages/core/src/";
import { MasterProcessor } from "../daydreams/packages/core/src/core/processors";
import { MessageProcessor } from "../daydreams/packages/core/src/core/processors";
import { MongoDb } from "../daydreams/packages/core/src/core/db/mongo-db";
import { Orchestrator } from "../daydreams/packages/core/src/core/orchestrator";
import { makeFlowLifecycle } from "../daydreams/packages/core/src/core/life-cycle";
import { defaultCharacter } from "./character.ts";
import { messageSchema } from "../daydreams/packages/core/src/core/io/discord";
import { SchedulerService } from "../daydreams/packages/core/src/";
import { TwitterClient } from "../daydreams/packages/core/src/core/io/twitter.ts";
import { balance_query, auction_query, land_query } from "./querys";
import { type Balance } from "./types";
import { getBalances } from "./ponziland-context";


/**
 * Helper function to get user input from CLI
 */
async function getCliInput(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    const loglevel = Types.LogLevel.DEBUG;
    // Initialize core components
    const llmClient = new LLMClient({
        model: "openrouter:google/gemini-2.0-flash-001",
        temperature: 0.15
    });

    const starknetChain = new Chains.StarknetChain({
        rpcUrl: env.STARKNET_RPC_URL,
        address: env.STARKNET_ADDRESS,
        privateKey: env.STARKNET_PRIVATE_KEY,
    });


    const memory = new ChromaVectorDB("agent_memory");

    const conversationManager = new ConversationManager(memory);
    let balances = await getBalances();

    const masterProcessor = new MasterProcessor(
        llmClient,
        defaultCharacter,
        ()  => getBalances(),
        loglevel
    );

    masterProcessor.addProcessor(
        new MessageProcessor(llmClient, defaultCharacter, loglevel)
    );

    // Connect to MongoDB (for scheduled tasks, if you use them)
    const KVDB = new MongoDb(
        "mongodb://localhost:27017",
        "myApp",
        "scheduled_tasks"
    );
    await KVDB.connect();
    console.log(chalk.green("✅ Scheduled task database connected"));

    // Clear any existing tasks if you like
    await KVDB.deleteAll();

    // Create the Orchestrator
    const core = new Orchestrator(
        masterProcessor,
        makeFlowLifecycle(KVDB, conversationManager),
        {
            level: loglevel,
            enableColors: true,
            enableTimestamp: true,
        }
    );


    // Initialize scheduler service
    const scheduler = new SchedulerService(
        {
            logger: new Logger({
                level: loglevel,
                enableColors: true,
                enableTimestamp: true,
            }),
            orchestratorDb: KVDB,
            conversationManager: conversationManager,
            vectorDb: memory,
        },
        core,
        10000
    );

    // Start scheduler service
    scheduler.start();

    await memory.purge(); // Clear previous session data

    // Load initial context documents
    await memory.storeDocument({
        title: "Game Context",
        content: CONTEXT,
        category: "context",
        tags: ["game-context"],
        lastUpdated: new Date(),
    });
    // Initialize the main reasoning engine
    const dreams = new ChainOfThought(llmClient, memory, getBalances, {
        worldState: CONTEXT,
    }, {
        logLevel: Types.LogLevel.DEBUG,
    });


    // Initialize the Discord client
    const discord = new DiscordClient(
        {
            discord_token: env.DISCORD_TOKEN,
            discord_bot_name: "johnny",
        },
        Types.LogLevel.DEBUG
    );

    const twitter = new TwitterClient(
        {
            username: env.TWITTER_USERNAME,
            password: env.TWITTER_PASSWORD,
            email: env.TWITTER_EMAIL,
        },
        loglevel
    );

    const consciousness = new Consciousness(llmClient, conversationManager, {
        intervalMs: 300000, // Think every 5 minutes
        minConfidence: 0.7,
        logLevel: loglevel,
    }, defaultCharacter);

    let provider = new RpcProvider({ nodeUrl: env.STARKNET_RPC_URL });
    let abi = manifest.contracts[0].abi;    
    let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);

    

    // Register available outputs
    dreams.registerOutput({
        name: "EXECUTE_TRANSACTION",
        role: Types.HandlerRole.OUTPUT,
        execute: async (data: any) => {
            const result = await starknetChain.write(data.payload)
            
            console.log("execute transaction result events", result.events);


            return result;
        },
        outputSchema: z.array(z
            .object({
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
        ).describe("Array of all calls to execute in transaction. Include all transactions here, instead of using this multiple times")
    });

    dreams.registerOutput({
        name: "FETCH",
        role: Types.HandlerRole.OUTPUT,
        execute: async (data: any) => {
            const { query } = data.payload ?? {};

            if (query == "balances") {

                let balances = await getBalances();

                return balances;
            } else if (query == "auctions") {

                let auction_str = await get_auctions_str();

                return auction_str;
            } else if (query == "lands") {
                
                let land_str = await get_lands_str();

                return land_str;
            } else if (query == "yield") {

                let yield_str = await get_lands_str();

                return yield_str;
            } else if (query == "neighbors") {

                let neighbors_str = await get_lands_str();

                return neighbors_str;
            }
            

        },
        outputSchema: z
            .object({
                query: z.string()
                    .describe(`"balances" or "auctions" or "owned-lands"`),
            })
            .describe(
                "The payload to fetch data from the Eternum GraphQL API, never include slashes or comments"
            ),
    });
    // Set up event logging
    dreams.on("think:start", ({ query }) => {
        console.log(chalk.blue("\n🧠 Thinking about:"), query);
    });

    dreams.on("action:start", (action) => {
        console.log(chalk.yellow("\n🎬 Executing action:"), {
            type: action.type,
            payload: action.payload,
        });
    });

    dreams.on("action:complete", ({ action, result }) => {
        console.log(chalk.green("\n✅ Action completed:"), {
            type: action.type,
            result,
        });
    });

    dreams.on("action:error", ({ action, error }) => {
        console.log(chalk.red("\n❌ Action failed:"), {
            type: action.type,
            error,
        });
    });

    core.registerIOHandler({
        name: "discord_stream",
        role: Types.HandlerRole.INPUT,
        subscribe: (onData) => {
            discord.startMessageStream(onData);
            console.log(onData)
            return () => {
                discord.stopMessageStream();
            };
        },
    });

    core.registerIOHandler({
        name: "consciousness_thoughts",
        role: Types.HandlerRole.INPUT,
        execute: async () => {
            console.log(chalk.blue("🧠 Generating thoughts..."));
            dreams.stepManager.clear();
            const thought = await consciousness.start();

            // If no thought was generated or it was already processed, skip
            if (!thought || !thought.content) {
                return [];
            }

            return {
                userId: "internal",
                threadId: "internal",
                contentId: "internal",
                platformId: "internal",
                data: thought,
            };
        },
    });

    core.registerIOHandler({
        name: "ponziland_action",
        role: Types.HandlerRole.ACTION,
        execute: async (data: any) => {
            console.log(data);
            let res = await dreams.think(data.action);
            console.log('ponziland action result', res);
            return res;
        },
        outputSchema: z.object({
            action: z.string()
                .describe(
                    "examples: ['check active auctions', 'check my lands ', 'check for cheap listings', 'claim my yield']"
                )
        }),
    });

    core.registerIOHandler({
        name: "tweet",
        role: Types.HandlerRole.OUTPUT,
        execute: async (data: unknown) => {
            const thoughtData = data as { content: string };

            // Post thought to Twitter
            return twitter.createTweetOutput().handler({
                content: thoughtData.content,
            });
        },
        outputSchema: z
            .object({
                content: z
                    .string()
                    .regex(
                        /^[\x20-\x7E]*$/,
                        "No emojis or non-ASCII characters allowed"
                    ),
            })
            .describe(
                "This is the content of the tweet you are posting. It should be a string of text that is 280 characters or less. Use this to post a tweet on the timeline."
            ),
    });

    // 2) REGISTER AN OUTPUT HANDLER
    //    This allows your Processor to suggest messages that are posted back to Discord

    core.registerIOHandler(discord.createMessageOutput());

        // Schedule a task to generate thoughts every 5 minutes
        await scheduler.scheduleTaskInDb(
            "johnny",
            "consciousness_thoughts",
            {},
            100000
        );
    

    // (Optional) Set up a console readline for manual input, etc.
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

   

    console.log(chalk.cyan("🤖 Bot is now running and monitoring Discord..."));
    console.log(
        chalk.cyan("You can also type messages in this console for debugging.")
    );
    console.log(chalk.cyan('Type "exit" to quit.'));

    // Handle graceful shutdown (Ctrl-C, etc.)
    process.on("SIGINT", async () => {
        console.log(chalk.yellow("\n\nShutting down..."));

        // If we want to stop the streaming IO handler:
        core.removeIOHandler("discord_stream");
        core.removeIOHandler("tweet");
        core.removeIOHandler("ponziland_action");
        core.removeIOHandler("consciousness_thoughts");
        // Also remove any other handlers or do cleanup
        core.removeIOHandler("discord_reply");
        rl.close();

        console.log(chalk.green("✅ Shutdown complete"));
        process.exit(0);
    });
}

// Application entry point with error handling
main().catch((error) => {
    console.error(chalk.red("Fatal error:"), error);
    process.exit(1);
});
