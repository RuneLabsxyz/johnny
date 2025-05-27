import { action } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, CallData, Contract, cairo } from "starknet";
import { Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents } from "../../utils/utils";
import manifest from "../../../../contracts/manifest_sepolia.json";
import ponziland_manifest from "../../../../manifest.json";
import { get_owned_lands } from "../../utils/querys"


export const level_up = (chain: StarknetChain) => action({
    name: "level-up",
    description: "Level up a land",
    schema: z.object({
        land_location: z.string().describe("Location of the land to level up"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];


        let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
        let ponziland_address = ponziland_manifest.contracts[0].address;

        let level_up_call: Call = {contractAddress: ponziland_address, entrypoint: "level_up", calldata: CallData.compile({land_location: data.land_location})};

        calls.push(level_up_call);


        let res = await chain.write(calls);

        return res;
    }
})

export const increase_stake = (chain: StarknetChain) => action({
    name: "increase-stake",
    description: "Increase the stake of a land. This amount should always be <10 tokens, x10^18 of course so to increase stake with 1 toke pass in 1000000000000000000",
    schema: z.object({
        land_location: z.string().describe("Location of the land to increase stake on"),
        amount: z.string().describe("The new stake amount (in wei, so x10^18)"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];

        let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
        let ponziland_address = ponziland_manifest.contracts[0].address;

        let lands = await get_owned_lands();

        console.log('lands', lands)
        let land;
        for (const l of lands) {
            if (Number(l.location) == Number(data.land_location)) {
                land = l;
                break;
            }
        }
        let token_address = land.token_used;
        console.log('token_address', token_address)
        let approve_call: Call = {contractAddress: token_address, entrypoint: "approve", calldata: CallData.compile({spender: ponziland_address, amount: cairo.uint256(data.amount)})};
        let increase_stake_call: Call = {contractAddress: ponziland_address, entrypoint: "increase_stake", calldata: CallData.compile({land_location: data.land_location, amount: cairo.uint256(data.amount)})};

        calls.push(approve_call);
        calls.push(increase_stake_call);

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
        let ponziland_address = ponziland_manifest.contracts[0].address;
        
        let increase_price_call: Call = {contractAddress: ponziland_address, entrypoint: "increase_price", calldata: CallData.compile({land_location: data.land_location, amount: cairo.uint256(data.amount)})};

        calls.push(increase_price_call);

        let res = await chain.write(calls);

        return res;
    }
})

