import { action, ActionCall, Agent, context, extension, formatXml, input } from "../../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../../fork/daydreams/packages/core/src";
import { StarknetChain } from "../../fork/daydreams/packages/core/src";
import manifest  from "../contracts/manifest_sepolia.json"
import { Contract, Abi, Call } from "starknet";

const template = `
  Location: {{location}}
  Status: {{status}}

  Neighbors: {{neighbors}}
  Goal: {{goal}}
`;

const orchardContext = context({
  type: "orchard",
  schema: z.object({
    id: z.string(),
    location: z.string(),
    status: z.string(),
    neighbors: z.array(z.string()),
    goal: z.string(),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      location: state.args.location,
      status: state.args.status,
      neighbors: state.args.neighbors,
      goal: state.args.goal,
    };
  },

  render({ memory }) {
    return render(template, {
      location: memory.location,
      status: memory.status,
      neighbors: memory.neighbors.join("\n"),
      goal: memory.goal,
    });
  },
});

export const orchard_action = (chain: StarknetChain, orchard_contract: Contract) => action({
    name: "orchard_action",
    description: "tend to your orchards in the ponziland frontier",
    schema: z.object({
        action: z.enum(["move", "plant", "tend"]).describe(`must be "move", "plant", or "tend" `),
        location: z.number().optional().describe(`location to move to choosing to move`)
    }),
    async handler(call: ActionCall<{
        action: 
            | "move"
            | "plant"
            | "tend"
        location?: number | undefined
    }>, ctx: any, agent: Agent) {

      let choice = call.data.action;

      let orchard_call: Call = {
        contractAddress: orchard_contract.address,
        entrypoint: choice,
        calldata: call.data.location ? [call.data.location] : []
      }

      let tx = await chain.write(orchard_call)

      console.log('tx result',tx)


      return JSON.stringify(tx)

    }

})

export const check_status = (orchard_contract: Contract) => input({
  schema: z.object({
    text: z.string(),
  }),
  format: (data) =>
    formatXml({
      tag: "status check",
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

        let text = `Decide what to do next if you are able to tend to your orchard`

        let goal = "Spread orchards around the ponziland frontier"

        //todo: get neighbors
        let neighbors = [""]

        let context = {
          id: "orchard",
          location: status.location,
          status: status.status,
          neighbors: neighbors,
          goal: goal
        }

        send(orchardContext, context, { text });
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
  console.log(orchard_contract);
  return extension({
  name: "orchard",
  contexts: {
    orchard: orchardContext,
  },
  inputs: {
    "check_status": check_status(orchard_contract),
  },
  actions: [
    orchard_action(chain, orchard_contract),
  ],

  });
}