import { z } from "zod";
import minimist from "minimist";
import { personality as ponziusPersonality } from "./characters/ponzius";
import { personality as duckPersonality } from "./characters/duck";
import { personality as everaiPersonality } from "./characters/everai";
import { personality as wolfPersonality } from "./characters/wolf";
import { personality as johnnyPersonality } from "./characters/johnny";

const personalities = {
    "ponzius": ponziusPersonality,
    "duck": duckPersonality,
    "everai": everaiPersonality,
    "wolf": wolfPersonality,
    "johnny": johnnyPersonality
}

const args = minimist(process.argv.slice(2));
const character = args.character;

export const getPersonality = () => {
    return personalities[character as keyof typeof personalities] || ponziusPersonality;
}

export const getEnvWithPrefix = (name: string) => {
    let prefix = name.toUpperCase();
  return {
    TWITTER_USERNAME: process.env[`${prefix}_TWITTER_USERNAME`],
    TWITTER_PASSWORD: process.env[`${prefix}_TWITTER_PASSWORD`], 
    DISCORD_TOKEN: process.env[`${prefix}_DISCORD_TOKEN`],
    DISCORD_BOT_NAME: process.env[`${prefix}_DISCORD_BOT_NAME`],
    STARKNET_ADDRESS: process.env[`${prefix}_STARKNET_ADDRESS`],
    STARKNET_PRIVATE_KEY: process.env[`${prefix}_STARKNET_PRIVATE_KEY`],

    CHROMA_URL: process.env.CHROMA_URL || "http://localhost:8000",
    STARKNET_RPC_URL: process.env.STARKNET_RPC_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GRAPHQL_URL: process.env.GRAPHQL_URL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || "ws://localhost:8080",
    SOCIALINK_API_KEY: process.env.SOCIALINK_API_KEY,
    DRY_RUN: process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true"
  };
}

export const env = getEnvWithPrefix(character);
