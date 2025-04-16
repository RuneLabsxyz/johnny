import { action, ActionCall, Agent, context, extension, formatXml, input } from "../../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../../fork/daydreams/packages/core/src";
import { StarknetChain } from "../../fork/daydreams/packages/defai/src";
import manifest  from "../contracts/manifest_sepolia.json"
import { Contract, Abi, Call } from "starknet";
import { execute_transaction } from "../actions/execute-transaction";
import { get_balances } from "../actions/get-balances";
import { get_lands_str, 
    } from "../contexts/ponziland-context";

import { character, personality } from "../characters/ponzius";

import { CONTEXT } from "../contexts/ponziland-context";
import { getBalances } from "../contexts/ponziland-context";
import { get_auctions, get_claims, get_lands, get_neighbors, get_nukeable_lands } from "../actions/ponziland/querys";
const template = `
  <character_info>
    {{character}}

    {{personality}}
  </character_info>

  {{guide}}

  -------------------------------
  Here is the current ponziland context:

  Your Lands: {{lands}}
  Goal: {{goal}}

  Token Balances: {{balance}}

  --------------------------------
  Make sure that you stop on a successful action, or if your attempt to act fails.
  Remember to only include a location if you are moving.

  You should send updates about everything you do in this discord channel: 1352657633374371861
  
  Only tweet if about your ponziland actions if you do something big like getting a new land or claiming a lot of tokens.
`;

const ponzilandContext = context({
  type: "ponziland",
  schema: z.object({
    id: z.string(),
    lands: z.string(),
    goal: z.string(),
    balance: z.string(),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      lands: state.args.lands,
      balance: state.args.balance,
      goal: state.args.goal,
    };
  },

  render({ memory }) {
    return render(template, {
      guide: CONTEXT,
      lands: memory.lands,
      balance: memory.balance,
      goal: memory.goal,
      character: character,
      personality: personality,
    });
  },
});

export const ponziland_check = (chain: StarknetChain) => input({
  schema: z.object({
    text: z.string(),
  }),
  format: (input) =>
    formatXml({
      tag: "status check",
      children: [
        {
          tag: "content",
          children: input.data.text,
        },
      ],
    }),
  subscribe(send, { container }) {
    // Check mentions every minute
    let index = 0;
    let timeout: ReturnType<typeof setTimeout>;

    // Function to schedule the next thought with random timing
    const scheduleNextThought = async () => {
      // Random delay between 3 and 10 minutes (180000-600000 ms)
      const minDelay = 180000; // 3 minutes
      const maxDelay = 300000; // 10 minutes
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      
      console.log(`Scheduling next ponziland check in ${randomDelay/60000} minutes`);
      
      timeout = setTimeout(async () => {

        let text = `Decide what action to take in ponziland, if any`

        let goal = "Build your bitcoin empire in ponziland"

        let lands = await get_lands_str()
        let balance = await getBalances()

        let context = {
          id: "ponziland",
          lands: lands,
          balance: balance,
          goal: goal,
          character: character,
          personality: personality,
        }

        console.log('ponziland context', context);

        send(ponzilandContext, context, { text });
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

export const ponziland = (chain: StarknetChain) => {

  return extension({
  name: "ponziland",
  contexts: {
    ponziland: ponzilandContext,
  },
  inputs: {
    "ponziland_check": ponziland_check(chain),
  },
  actions: [
    execute_transaction(chain),
    get_lands(chain),
    get_auctions(chain),
    get_nukeable_lands(chain),
    get_claims(chain),
    get_neighbors(chain),
  ],

  });
}