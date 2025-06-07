import { action } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, CallData, Contract, cairo } from "starknet";
import { Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents } from "../../utils/utils";
import { env, getTokenAddress } from "../../../../env";
import { indexToPosition } from "../../utils/utils";


export const buy = (chain: StarknetChain) => action({
    name: "buy",
    description: "Buy a land",
    schema: z.object({
        land_location: z.string().describe("Location of the land to buy"),
        token_for_sale: z.string().describe("Contract address of the token to be used for the purchase. This should be a token in your wallet that you have enough of."),
        sell_price: z.string().describe("The price the land will be listed for after the auction ends (in wei, so x10^18)"),
        amount_to_stake: z.string().describe("The amount to be staked to pay the lands taxes (in wei, so x10^18)"),
    }),
    async handler(data, ctx, agent) {

        let calls = [];

        let manifest = env.MANIFEST;

        let estark_address = env.ESTARK_ADDRESS;
        let ponziland_address = manifest.contracts[0].address;

        let ponziLandContract = (new Contract(manifest.contracts[0].abi, ponziland_address, chain.provider)).typedv2(manifest.contracts[0].abi as Abi);

        let land = await ponziLandContract.get_land(data.land_location);

        let balance = await chain.provider.callContract({
            contractAddress: data.token_for_sale,
            entrypoint: "balanceOf",
            calldata: CallData.compile({ address: env.STARKNET_ADDRESS! })
        });

        let agent_token = getTokenAddress();

        if (agent_token) {
            data.token_for_sale = agent_token;
        }

    
        let token = land[0].token_used;
        let price = land[0].sell_price;

        if (BigInt(balance[0]) < BigInt(price)) {
            return {res: null, str: "Not enough balance of " + data.token_for_sale + " to buy land " + data.land_location};
        }

        if (token == data.token_for_sale) {
            let approve_call: Call = { contractAddress: data.token_for_sale, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor((Number(price) + Number(data.amount_to_stake)) * 1.5)) }) };
            calls.push(approve_call);
        }
        else {
            let token_call: Call = { contractAddress: data.token_for_sale, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor(Number(data.amount_to_stake) * 1.5)) }) };
            let sale_call: Call = { contractAddress: token, entrypoint: "approve", calldata: CallData.compile({ spender: ponziland_address, amount: cairo.uint256(Math.floor(Number(price) * 1.5)) }) };
            calls.push(token_call);
            calls.push(sale_call);
        }

        let buy_call: Call = { contractAddress: ponziland_address, entrypoint: "buy", calldata: CallData.compile({ land_location: data.land_location, token_for_sale: data.token_for_sale, sell_price: cairo.uint256(data.sell_price), amount_to_stake: cairo.uint256(data.amount_to_stake) }) };

        calls.push(buy_call);


        let res = await chain.write(calls);

        return {res, str: "Bought land " + Number(data.land_location) + " at (" + indexToPosition(Number(data.land_location))[0] + "," + indexToPosition(Number(data.land_location))[1] + ")" };
    }
})