import { action, ActionCall, Agent, context, extension, formatXml, input } from "../../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../../fork/daydreams/packages/core/src";
import { StarknetChain } from "../../fork/daydreams/packages/core/src";
import manifest  from "../contracts/manifest_sepolia.json"
import { Contract, Abi } from "starknet";
const orchardContext = context({
  type: "orchard",
  key: ({ userId }) => userId.toString(),
  schema: z.object({
    userId: z.string(),
  }),
});

export const orchard_action = (chain: StarknetChain) => action({
    name: "orchard_action",
    description: "tend to your orchards in the ponziland frontier",
    schema: z.object({
        action: z.enum(["move", "plant", "tend"]).describe(`must be "move", "plant", or "tend" `)
    }),
    async handler(call: ActionCall<{
        action: 
            | "move"
            | "plant"
            | "tend"
    }>, ctx: any, agent: Agent) {
        
       //todo

    }

})

export const check_status = (orchard_contract: Contract) => input({
  schema: z.object({
    text: z.string(),
  }),
  format: (data) =>
    formatXml({
      tag: "consciousness",
      content: data.text,
    }),
  subscribe(send, { container }) {
    // Check mentions every minute
    let index = 0;
    let timeout: NodeJS.Timeout;

    // Function to schedule the next thought with random timing
    const scheduleNextThought = async () => {
      // Random delay between 3 and 10 minutes (180000-600000 ms)
      const minDelay = 180000; // 3 minutes
      const maxDelay = 3000000; // 10 minutes
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      
      console.log(`Scheduling next orchard check in ${randomDelay/60000} minutes`);
      
      timeout = setTimeout(async () => {

        let status = await orchard_contract.get_johnny()

        console.log(status);

        let status_text = `Your avatar is currently at location ${status.location} and is ${status.status}`


        send(orchardContext, { userId: "thought: " + index }, { text: status_text });
        index += 1;
        
        // Schedule the next thought
        scheduleNextThought();
      }, randomDelay);
    };
    
    // Start the first thought cycle
    scheduleNextThought();

    return () => clearTimeout(timeout);
  },
});



export const orchard = (chain: StarknetChain) => {

  let orchard_contract = new Contract(manifest.contracts[0].abi, manifest.contracts[0].address, chain.provider).typedv2(manifest.contracts[0].abi as Abi);
    
  return extension({
  name: "orchard",
  contexts: {
    orchard: orchardContext,
  },
  inputs: {
    "check_status": check_status(orchard_contract),
  },
  actions: [
    orchard_action(chain),
  ],

  });
}