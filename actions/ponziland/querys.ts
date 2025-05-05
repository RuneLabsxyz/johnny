import { action } from "../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { get_claims_str, get_lands_str, get_neighbors_str, getBalances, get_all_lands_str } from "../../contexts/ponziland-context"
import { get_auctions_str } from "../../contexts/ponziland-context"
import { get_nukeable_lands_str } from "../../contexts/ponziland-context"
import { Abi, Contract } from "starknet"
import manifest from "../../contracts/manifest_release.json"

export const get_auctions = (chain: StarknetChain) => action({
    name: "get-auctions",
    description: "Get all of the active auctions",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {
        
       //todo
       let auctions = await get_auctions_str()

       console.log('auctions', auctions)

       return auctions

    }
});

export const get_owned_lands = (chain: StarknetChain) => action({
    name: "get-owned-lands",
    description: "Get all of your lands in ponziland",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {
        
       //todo
       let lands = await get_lands_str()

       console.log('lands str', lands)

       if (lands == "") {
        return "You do not own any lands"
       }

       return lands

    }
});

export const get_claims = (chain: StarknetChain) => action({
    name: "get-claims",
    description: "Get all of the claims in ponziland",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {
        
       //todo
       let claims = await get_claims_str()

       return claims

    }
});

export const get_neighbors = (chain: StarknetChain) => action({
    name: "get-neighbors",
    description: "Get all of your lands neighbors in ponziland",
    schema: z.object({location: z.number()}),
    async handler(data: {location: number}, ctx: any, agent: Agent) {

       //todo
       let neighbors = await get_neighbors_str(data.location);

       if (neighbors == "") {
        return "Failed to get neighbors for location " + location + ". land may not exist."
       }

       return neighbors

    }
});

export const get_all_lands = (chain: StarknetChain) => action({
    name: "get-all-lands",
    description: "Get all of the lands in ponziland",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {

        let lands = await get_all_lands_str()

        console.log('lands', lands)

        return lands
        
    }
})