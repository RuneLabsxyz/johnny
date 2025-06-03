import { action } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, CallData, Contract, cairo } from "starknet";
import { Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents } from "../../utils/utils";
import { get_owned_lands } from "../../utils/querys"
import { env } from "../../../../env";

let manifest = env.MANIFEST;

export const level_up = (chain: StarknetChain) => action({
    name: "level-up",
    description: "Level up a land",
    schema: z.object({
        land_location: z.string().describe("Location of the land to level up"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];


        let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
        let ponziland_address = manifest.contracts[0].address;

        let level_up_call: Call = { contractAddress: ponziland_address, entrypoint: "level_up", calldata: CallData.compile({ land_location: data.land_location }) };

        calls.push(level_up_call);


        let res = await chain.write(calls);

        return res;
    }
})

export const increase_stake = (chain: StarknetChain) => action({
    name: "increase-stake",
    description: "Increase the stake for your lands. These amounts should always be 10 < amount < 20 tokens, x10^18 of course so to increase stake with 10 toke pass in 10000000000000000000",
    schema: z.object({
        calls: z.array(z.object({
            land_location: z.string().describe("Location of the land to increase stake on"),
            amount: z.string().describe("The new stake amount (in wei, so x10^18)"),
        })).describe("The locations and amounts of the lands you are increasing the stake for"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];
        let tokenAmounts: { [tokenAddress: string]: bigint } = {};

        let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
        let ponziland_address = manifest.contracts[0].address;

        let lands = await get_owned_lands();

        // First pass: collect all increase_stake calls and track token amounts
        for (const call of data.calls) {
            let land;
            for (const l of lands) {
                if (Number(l.location) == Number(call.land_location)) {
                    land = l;
                    break;
                }
            }
            let token_address = land.token_used;
            console.log('token_address', token_address)

            // Track total amount needed for each token
            if (!tokenAmounts[token_address]) {
                tokenAmounts[token_address] = BigInt(0);
            }
            tokenAmounts[token_address] += BigInt(call.amount);

            // Add the increase_stake call
            let increase_stake_call: Call = { contractAddress: ponziland_address, entrypoint: "increase_stake", calldata: CallData.compile({ land_location: call.land_location, amount: cairo.uint256(call.amount) }) };
            calls.push(increase_stake_call);
        }

        // Second pass: add bundled approve calls at the beginning
        let approveCalls: Call[] = [];
        for (const [token_address, totalAmount] of Object.entries(tokenAmounts)) {
            let approve_call: Call = { contractAddress: token_address, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(totalAmount.toString()) }) };
            approveCalls.push(approve_call);
        }

        // Prepend approve calls to the beginning of the calls array
        calls = [...approveCalls, ...calls];

        let res = await chain.write(calls);
        console.log('res', res)

        return res;


    }
})

export const increase_price = (chain: StarknetChain) => action({
    name: "increase-price",
    description: "Increase the price of a land",
    schema: z.object({
        land_location: z.string().describe("Location of the land to increase price on"),
        amount: z.string().describe("The new price amount (in wei, so x10^18)"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];

        let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
        let ponziland_address = manifest.contracts[0].address;

        let increase_price_call: Call = { contractAddress: ponziland_address, entrypoint: "increase_price", calldata: CallData.compile({ land_location: data.land_location, amount: cairo.uint256(data.amount) }) };

        calls.push(increase_price_call);

        let res = await chain.write(calls);

        return res;
    }
})

