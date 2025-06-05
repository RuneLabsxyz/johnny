import { z } from "zod";
import minimist from "minimist";
import { personality as ponziusPersonality } from "./characters/ponzius";
import { personality as duckPersonality } from "./characters/duck";
import { personality as everaiPersonality } from "./characters/everai";
import { personality as wolfPersonality } from "./characters/wolf";
import { personality as johnnyPersonality } from "./characters/johnny";
import { personality as blobertPersonality } from "./characters/blobert";

import manifest_mainnet from "./contracts/ponziland_manifest_mainnet.json";
import view_manifest_mainnet from "./contracts/view_manifest_mainnet.json";
import manifest_sepolia from "./contracts/ponziland_manifest_sepolia.json";
import view_manifest_sepolia from "./contracts/view_manifest_sepolia.json";


const personalities = {
  "ponzius": ponziusPersonality,
  "duck": duckPersonality,
  "everai": everaiPersonality,
  "wolf": wolfPersonality,
  "johnny": johnnyPersonality,
  "blobert": blobertPersonality
}

const args = minimist(process.argv.slice(2));
const character = args.character;
const network = args.network || "sepolia";
const discord = args.main_discord ? { chat: "1379975758574915654", thoughts: "1379477765786701824" } : { chat: "1379102407459602503", thoughts: "1352657633374371861" };

export const getPersonality = () => {
  return personalities[character as keyof typeof personalities](env.DISCORD_THOUGHTS_CHANNEL_ID) || ponziusPersonality(env.DISCORD_THOUGHTS_CHANNEL_ID);
}

export const getEnvWithPrefix = (name: string) => {
  let prefix = name.toUpperCase();
  let networkPrefix = network.toUpperCase();
  let manifest = network.toLowerCase() === "sepolia" ? manifest_sepolia : manifest_mainnet;
  let view_manifest = network.toLowerCase() === "sepolia" ? view_manifest_sepolia : view_manifest_mainnet;
  let estark_address = network.toLowerCase() === "sepolia" ? "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0" : "0x056893df1e063190aabda3c71304e9842a1b3d638134253dd0f69806a4f106eb";
  return {
    TWITTER_USERNAME: process.env[`${prefix}_TWITTER_USERNAME`],
    TWITTER_PASSWORD: process.env[`${prefix}_TWITTER_PASSWORD`],
    DISCORD_TOKEN: process.env[`${prefix}_DISCORD_TOKEN`],
    DISCORD_BOT_NAME: process.env[`${prefix}_DISCORD_BOT_NAME`],
    STARKNET_ADDRESS: process.env[`${prefix}_${networkPrefix}_STARKNET_ADDRESS`],
    STARKNET_PRIVATE_KEY: process.env[`${prefix}_${networkPrefix}_STARKNET_PRIVATE_KEY`],
    GRAPHQL_URL: process.env[`${networkPrefix}_GRAPHQL_URL`],

    CHROMA_URL: process.env.CHROMA_URL || "http://localhost:8000",
    STARKNET_RPC_URL: process.env[`${networkPrefix}_STARKNET_RPC_URL`],
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || "ws://localhost:8080",
    SOCIALINK_API_KEY: process.env.SOCIALINK_API_KEY,
    DRY_RUN: process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true",
    AVNU_API_KEY: process.env.AVNU_API_KEY,
    AVNU_BASE_URL: network.toLowerCase() === "sepolia" ? "https://sepolia.api.avnu.fi" : "https://api.avnu.fi",
    MANIFEST: manifest,
    VIEW_MANIFEST: view_manifest,
    ESTARK_ADDRESS: estark_address,
    DISCORD_CHAT_CHANNEL_ID: discord.chat,
    DISCORD_THOUGHTS_CHANNEL_ID: discord.thoughts,
  };
}

export const env = getEnvWithPrefix(character);
