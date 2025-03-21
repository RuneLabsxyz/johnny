import { action } from "../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../fork/daydreams/packages/core/src"
import { ActionCall } from "../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { get_claims_str, get_lands_str, get_neighbors_str, getBalances } from "../../contexts/ponziland-context"
import { get_auctions_str } from "../../contexts/ponziland-context"
import { get_nukeable_lands_str } from "../../contexts/ponziland-context"

export const get_auctions = (chain: StarknetChain) => action({
    name: "get-auctions",
    description: "Get all of the active auctions",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo
       let auctions = await get_auctions_str()

       return auctions

    }
});

export const get_lands = (chain: StarknetChain) => action({
    name: "get-lands",
    description: "Get all of the lands in ponziland",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo
       let lands = await get_lands_str()

       return lands

    }
});

export const get_nukeable_lands = (chain: StarknetChain) => action({
    name: "get-nukeable-lands",
    description: "Get the lands in ponziland that can be nuked",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo
       let nukable_lands = await get_nukeable_lands_str()

       return nukable_lands

    }
});

export const get_claims = (chain: StarknetChain) => action({
    name: "get-claims",
    description: "Get all of the claims in ponziland",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo
       let claims = await get_claims_str()

       return claims

    }
});

export const get_neighbors = (chain: StarknetChain) => action({
    name: "get-neighbors",
    description: "Get all of your lands neighbors in ponziland",
    schema: z.object({}),
    async handler(call: ActionCall<{}>, ctx: any, agent: Agent) {
        
       //todo
       let neighbors = await get_neighbors_str()

       return neighbors

    }
});