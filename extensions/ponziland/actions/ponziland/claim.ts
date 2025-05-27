import { input, context } from "../../../../../fork/daydreams/packages/core/src"
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
import { get_owned_lands, get_lands_str, get_balances_str } from "../../utils/querys";
import { CONTEXT } from "../../contexts/ponziland-context";
import { env } from "../../../../env";
import { getPersonality } from "../../../../env";

// Import the ponzilandContext from the main ponziland file
const ponzilandContext = context({
  type: "ponziland",
  schema: z.object({
    id: z.string(),
    lands: z.string(),
    goal: z.string(),
    balance: z.string(),
    context: z.string(),
  }),
  key({ id }) {
    return id;
  },
});

export const claim_all = (chain: StarknetChain) => input({
    schema: z.object({
      text: z.string(),
    }),
    subscribe(send, { container }) {
      let index = 0;
      let timeout: ReturnType<typeof setTimeout>;

      // Function to schedule the next claim with random timing
      const scheduleNextClaim = async () => {
        // Random delay between 2 and 6 hours (7200000-21600000 ms)
        const minDelay = 1800000; // 30 minutes
        const maxDelay = 3600000; // 60 minutes
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        console.log(`Scheduling next claim in ${randomDelay/3600000} hours`);
        
        timeout = setTimeout(async () => {
          try {
            let calls = [];

            let estark_address = "0x071de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0";
            let ponziland_address = ponziland_manifest.contracts[0].address;

            let lands = await get_owned_lands();

            if (!lands || lands.length === 0) {
              console.log('No lands owned, skipping claim');
              scheduleNextClaim();
              return;
            }

            let locations = lands.map((land: any) => land.location);

            let claim_call: Call = {contractAddress: ponziland_address, entrypoint: "claim_all", calldata: CallData.compile({locations: locations})};
            calls.push(claim_call);

            let res = await chain.write(calls);

            let transfers = await decodeTokenTransferEvents(res);

            if (!transfers) {
              transfers = "No transfers. Do you own any lands?";
            }

            const claimResult = `Claimed taxes from ${locations.length} lands. TX: ${res.transaction_hash} - Status: ${res.execution_status} - Transfers: ${JSON.stringify(transfers)}`;
            
            console.log('Claim completed: ' + claimResult);

            // Get current state for ponzilandContext
            let goal = "Get lands for you team in PonziLand";
            let landsStr = await get_lands_str(env.STARKNET_ADDRESS!);
            let balance = await get_balances_str();
            let guide = await CONTEXT();
            let personality = getPersonality();

            send(ponzilandContext, { 
              id: "ponziland-claim-" + index,
              lands: landsStr,
              goal: goal,
              balance: balance,
              personality: personality,
              context: `Just claimed taxes! ${claimResult}. ${guide}`
            }, { text: claimResult });
            
            index += 1;
          } catch (error) {
            console.error('Error during claim:', error);
          }
          
          // Schedule the next claim
          scheduleNextClaim();
        }, randomDelay);
      };
      
      // Start the first claim cycle
      scheduleNextClaim();
  
      return () => clearTimeout(timeout);
    },
})