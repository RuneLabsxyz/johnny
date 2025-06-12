import { action } from "../../../../../fork/daydreams/packages/core/src"
import { StarknetChain } from "../../../../../fork/daydreams/packages/defai/src"
import { ActionCall } from "../../../../../fork/daydreams/packages/core/src"
import { Agent } from "../../../../../fork/daydreams/packages/core/src"
import { z } from "zod"
import { Abi, CallData, Contract, cairo } from "starknet";
import { Call } from "starknet";
import { getLiquidityPoolFromAPI } from "../../utils/ponziland_api"
import { decodeTokenTransferEvents, getTokenData } from "../../utils/utils";
import { env, getTokenAddress } from "../../../../env";
import { indexToPosition } from "../../utils/utils";
import view_manifest from "../../../../contracts/view_manifest_mainnet.json";

export const buy = (chain: StarknetChain) => action({
    name: "buy",
    description: "Buy a land or Bid on a list of lands. These can be a mix of lands and auctions. Be careful to make sure you have enough tokens for all calls",
    schema: z.object({
        calls: z.array(z.object({
            land_location: z.string().describe("Location of the land to buy"),
            token_for_sale: z.string().describe("Contract address of the token to be used for the purchase. This should be a token in your wallet that you have enough of."),
            sell_price: z.string().describe("The price the land will be listed for after the auction ends (in wei, so x10^18)"),
            amount_to_stake: z.string().describe("The amount to be staked to pay the lands taxes (in wei, so x10^18)"),
    }))}),
    async handler(data: { calls: { land_location: string, token_for_sale: string, sell_price: string, amount_to_stake: string }[] }, ctx: any, agent: Agent) {
        let calls = [];
        let tokenAmounts: { [tokenAddress: string]: bigint } = {};

        let manifest = env.MANIFEST;
        let estark_address = env.ESTARK_ADDRESS;
        let ponziland_address = manifest.contracts[0].address;

        console.log(chain.provider)

        let ponziLandContract = (new Contract(manifest.contracts[0].abi, ponziland_address, chain.provider)).typedv2(manifest.contracts[0].abi as Abi);
        let viewContract = new Contract(view_manifest.contracts[0].abi, view_manifest.contracts[0].address, chain.provider);

        for (let call of data.calls) {
            let land_or_auction = await viewContract.get_land_or_auction(call.land_location);
            let land_type = land_or_auction.activeVariant();
            let agent_token = getTokenAddress();

            if (agent_token) {
                call.token_for_sale = agent_token;
            }

            if (land_type == "Land") {
                let land = land_or_auction.unwrap();
                let price = land.sell_price;

                // Track amounts for each token
                if (land.token_used != call.token_for_sale) {
                    if (!tokenAmounts[land.token_used]) {
                        tokenAmounts[land.token_used] = BigInt(0);
                    }
                    tokenAmounts[land.token_used] += BigInt(price);

                    if (!tokenAmounts[call.token_for_sale]) {
                        tokenAmounts[call.token_for_sale] = BigInt(0);
                    }
                    tokenAmounts[call.token_for_sale] += BigInt(call.amount_to_stake);
                } else {
                    if (!tokenAmounts[call.token_for_sale]) {
                        tokenAmounts[call.token_for_sale] = BigInt(0);
                    }
                    tokenAmounts[call.token_for_sale] += BigInt(price) + BigInt(call.amount_to_stake);
                }

                let buy_call = { 
                    contractAddress: ponziland_address, 
                    entrypoint: "buy", 
                    calldata: CallData.compile({ 
                        land_location: call.land_location, 
                        token_for_sale: call.token_for_sale, 
                        sell_price: cairo.uint256(price), 
                        amount_to_stake: cairo.uint256(call.amount_to_stake) 
                    }) 
                };
                calls.push(buy_call);
            } else {
                let auction = land_or_auction.unwrap();
                let price = await ponziLandContract.get_current_auction_price(call.land_location);

                // Track amounts for each token
                if (call.token_for_sale == estark_address) {
                    if (!tokenAmounts[estark_address]) {
                        tokenAmounts[estark_address] = BigInt(0);
                    }
                    tokenAmounts[estark_address] += BigInt(price) + BigInt(call.amount_to_stake);
                } else {
                    if (!tokenAmounts[estark_address]) {
                        tokenAmounts[estark_address] = BigInt(0);
                    }
                    tokenAmounts[estark_address] += BigInt(price);

                    if (!tokenAmounts[call.token_for_sale]) {
                        tokenAmounts[call.token_for_sale] = BigInt(0);
                    }
                    tokenAmounts[call.token_for_sale] += BigInt(call.amount_to_stake);
                }

                let bid_call = { 
                    contractAddress: ponziland_address, 
                    entrypoint: "bid", 
                    calldata: CallData.compile({ 
                        land_location: call.land_location, 
                        token_for_sale: call.token_for_sale, 
                        sell_price: cairo.uint256(price), 
                        amount_to_stake: cairo.uint256(call.amount_to_stake) 
                    }) 
                };
                calls.push(bid_call);
            }
        }

        // Add bundled approve calls at the beginning
        let approveCalls: Call[] = [];
        for (const [token_address, totalAmount] of Object.entries(tokenAmounts)) {
            let approve_call: Call = { 
                contractAddress: token_address, 
                entrypoint: "approve", 
                calldata: CallData.compile({ 
                    spender: ponziland_address, 
                    amount: cairo.uint256(totalAmount.toString()) 
                }) 
            };
            approveCalls.push(approve_call);
        }

        // Prepend approve calls to the beginning of the calls array
        calls = [...approveCalls, ...calls];

        let res = await chain.write(calls);

        return {
            res, 
            str: "Bought lands " + data.calls.map((call: { land_location: string }) => call.land_location).join(", ") + 
                 " at (" + data.calls.map((call: { land_location: string }) => 
                 indexToPosition(Number(call.land_location))[0] + "," + 
                 indexToPosition(Number(call.land_location))[1]).join(", ") + ")"
        };
    }
})