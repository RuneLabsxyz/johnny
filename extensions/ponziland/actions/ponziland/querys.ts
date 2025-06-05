import { action, type ActionSchema } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, Contract } from "starknet"
import { CONTEXT } from "../../contexts/ponziland-context"
import { get_auctions_str, get_claims_str, get_lands_str, get_neighbors_str, get_all_lands_str, get_auction_yield_str,get_unowned_land_yield_str, get_prices_str, query_lands_under_price_str } from "../../utils/querys"
import { env } from "../../../../env"
import { lookupUserByProvider } from "extensions/ponziland/utils/ponziland_api"


let view_manifest = env.VIEW_MANIFEST;

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

export const get_prices = (chain: StarknetChain) => action({
    name: "get-prices",
    description: "Get the current prices of all tokens in ponziland",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {

        let prices = await get_prices_str()

        return prices

    }
})

export const get_owned_lands = (chain: StarknetChain) => action({
    name: "get-owned-lands",
    description: "Get all of your lands in ponziland. Remember this expects no arguments. The content for this action should always be {}",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {

        let address = env.STARKNET_ADDRESS!;
        //todo
        let lands = await get_lands_str(address)

        console.log('lands str', lands)

        if (lands == "") {
            return "You do not own any lands"
        }

        return lands

    }
});

export const get_claims = (chain: StarknetChain) => action({
    name: "get-claims",
    description: "Get all of the claims in ponziland. Remember this expects no arguments",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {

        //todo
        let claims = await get_claims_str()

        return claims

    }
});

export const get_neighbors = (chain: StarknetChain) => action({
    name: "get-neighbors",
    description: "Get all of your lands neighbors in ponziland. Remember this expects a location argument",
    schema: z.object({ location: z.number() }),
    async handler(data: { location: number }, ctx: any, agent: Agent) {

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

export const get_context = (chain: StarknetChain) => action({
    name: "get-context",
    description: "Get general information about Ponziland. This should be called first before attempting any other ponziland actions. The content for this action should always be {}",
    schema: z.object({}),
    async handler(data: {}, ctx: any, agent: Agent) {

        let res = await CONTEXT();
        console.log('res', res)
        return res

    }
})

export const evaluate_auction = (chain: StarknetChain) => action({
    name: "evaluate-auction",
    description: "Evaluate to potential opportunity of a land that is up for auction. This expects a location argument. This should be called to evaluate auctions before deciding to bid or not,.",
    schema: z.object({ location: z.number() }),
    async handler(data: { location: number }, ctx: any, agent: Agent) {

        let info = await get_unowned_land_yield_str(data.location);

        return info;

    }
})

export const evaluate_land = (chain: StarknetChain) => action({
    name: "evaluate-land",
    description: "Evaluate the potential opportunity of a given land. This expects a location argument. This should be called to evaluate lands before deciding to buy or not,.",
    schema: z.object({ location: z.number() }),
    async handler(data: { location: number }, ctx: any, agent: Agent) {

        let info = await get_unowned_land_yield_str(data.location);

        return info;

    }
})

export const get_player_lands = (chain: StarknetChain) => action({
    name: "get-player-lands",
    description: "Get all of the lands that a player owns in ponziland. This expects a starknet address argument",
    schema: z.object({ address: z.string() }),
    async handler(data: { address: string }, ctx: any, agent: Agent) {

        let res = await get_lands_str(data.address);

        return res;


    }
})

export const query_lands_under_price = action({
    name: "query-lands-under-price",
    description: "Query all lands listed in a given token under a certain price. This expects a price and token argument",
    schema: z.object({ price: z.number(), token: z.string() }),
    async handler(data: { price: number, token: string }, ctx: any, agent: Agent) {

        let res = await query_lands_under_price_str(data.price, data.token);

        return res;

    }
})

export const socialink_lookup = action({
    name: "socialink-lookup",
    description: "Lookup a user's socialink profile using their discord username. This returns their starknet address if they are registered",
    schema: z.object({ username: z.string() }),
    async handler(data: { username: string }, ctx: any, agent: Agent) {

        let res = await lookupUserByProvider("discord", data.username);

        return res;

    }
})
