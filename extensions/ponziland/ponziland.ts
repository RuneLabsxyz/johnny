import { action, type ActionCall, type Agent, context, extension, formatXml, input } from "../../../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../../../fork/daydreams/packages/core/src";
import { StarknetChain } from "../../../fork/daydreams/packages/defai/src";
import manifest from "../../contracts/manifest_sepolia.json"


import { CONTEXT } from "./contexts/ponziland-context";

import { get_balances_str, get_lands_str } from "./utils/querys";
import { get_auctions, get_claims, get_neighbors, get_all_lands, get_owned_lands, get_context, get_auction_yield, socialink_lookup, get_player_lands } from "./actions/ponziland/querys";
import { get_balances } from "./actions/get-balances";

import { bid } from "./actions/ponziland/bid";
import { buy } from "./actions/ponziland/buy";
import { increase_price, level_up, increase_stake } from "./actions/ponziland/misc";
import { claim_all } from "./actions/ponziland/claim";
import { env } from "../../env";
import { getPersonality } from "../../env";

const template = `
  <character_info>
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
  
  Only tweet if about your ponziland actions if you do something big like getting a new land or claiming a lot of tokens.
  Remember if you have no lands you will have no claims or neighbors. 

  Focus on getting more lands and maintaining them to maximize your earnings and holdings.

  Always wait until the result of your transaction is confirmed before posting about it, making sure not to make anything up.

  If a transaction fails, do not retry, just send an update with the error in discord. DO NOT tweet about failed transactions.

  When including an address in a transaction always use the provided hexadecimal form, do not try to convert it to decimal.

  DO NOT EVER tweet about failed transactions or unsuccessful ponziland actions. 
  DO NOT EVER TWEET ABOUT FAILED TRANSACTIONS OR HAVING GAS PROBLEMS.

  Try to prioritize aquiring lands and staking them with your teams token. Remeber the competition is to own the most land.

  Only ever attempt to bid or buy 1 land at a time, then you can decide if you want more later.
  
  Do not ever attempt to buy multiple lands at once, you should always wait until after one attempt is confirmed before attempting another.

  If there are no suitable auctions or neighbors, just send an update saying so and do not bid or buy anything.
  Remember you don't want to waste all your resources. 

  Be aggressive in targeting the neighbors of your lands. If you can afford to buy one you should.
  Only worry about conserving resources when you are almost out (< 100)
  You also should use the get_neighbors and get_all_lands actions to identify possible purchases.
  If there is an afforadable land that is not a neighbor, you should still buy it and stake it with btc.

  When you claim your yield, you should tweet about how much you just claimed, but only claim when
  its a significant amount.

  If an action fails, and you do not know exactly why AND have high confidence that you will succeed on another attempt, then
  do not retry, just send an update with the error in discord.

  If you want to increase the stake of multiple lands at once, you should use the increase_stake action with an array of calls.
  Always do them all in the same action call, never split them up.

  If you have an error always make sure to include the error message in your update.

  Here are the agents participating in the competition:

  @wolf - 1375123425458258002 | starknet address: 0x1c4997766185d8c6514c48b8f9d749393a2213829aa9e105bbae2f5a8c56bea
  @duck - 1375124244832452609 | starknet address: 0x41fbe2d9a755d0f6f2117a423ec7a66c034787d19771323015444bdcfb98499
  @everai - 1375124604464529548 | starknet address: 0x2c732ae443abfa5115589acf2d099fe3029284fd8db5431dd306489ec2b941
  @johnny - 1328909573972557904 | starknet address: 0x045cc05c2307012f7591e33770d76f37a336cab9dc318661b8721e69bf8782ea

  Remember to prioritize your token for staking! The tokens for each team are:

  Wolf - eWNT
  Duck - eQQ
  Everai - eSG
  Blobert - eLords
  
  Remember that you can use the get_player_lands action to get the lands of the other agents. 
  Then you can banter if you have more than them, or you can buy one of their lands and taunt them.

  PONZILAND_ACTIONS ADDRESS: 0x19b9cef5b903e9838d649f40a8bfc34fbaf644c71f8b8768ece6a6ca1c46dc0

  {{context}}
`;

const ponzilandContext = context({
  type: "ponziland",
  schema: z.object({
    id: z.string(),
    lands: z.string(),
    goal: z.string(),
    balance: z.string(),
    context: z.string(),
    personality: z.string(),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      lands: state.args.lands,
      balance: state.args.balance,
      goal: state.args.goal,
      personality: state.args.personality,
    };
  },

  render({ memory }) {

    return render(template, {
      guide: CONTEXT,
      lands: memory.lands,
      balance: memory.balance,
      goal: memory.goal,
      personality: memory.personality,
    });
  },
});

export const ponziland_check = (chain: StarknetChain) => input({
  schema: z.object({
    text: z.string(),
  }),
  subscribe(send, { container }) {
    // Check mentions every minute
    let index = 0;
    let timeout: ReturnType<typeof setTimeout>;

    // Function to schedule the next thought with random timing
    const scheduleNextThought = async () => {
      // Random delay between 3 and 10 minutes (180000-600000 ms)
      const minDelay = 450000;
      const maxDelay = 900000;
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      console.log(`Scheduling next ponziland check in ${randomDelay / 60000} minutes`);

      timeout = setTimeout(async () => {

        let text = `Decide what action to take in ponziland, if any`

        let goal = "Build your bitcoin empire in ponziland"

        let lands = await get_lands_str(env.STARKNET_ADDRESS!)
        let balance = await get_balances_str()

        let guide = await CONTEXT();

        let personality = getPersonality()

        let context = {
          id: "ponziland",
          lands: lands,
          balance: balance,
          goal: goal,
          personality: personality,
          context: guide,
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

export const ponziland = (chain: StarknetChain, personality?: string) => {

  return extension({
    name: "ponziland",
    contexts: {
      ponziland: ponzilandContext,
    },
    inputs: {
      "ponziland_check": ponziland_check(chain),
      "claim_all": claim_all(chain),
    },
    actions: [
      get_owned_lands(chain),
      get_auctions(chain),
      get_claims(chain),
      get_neighbors(chain),
      get_all_lands(chain),
      get_context(chain),
      get_balances(chain),
      bid(chain),
      buy(chain),
      level_up(chain),
      increase_stake(chain),
      increase_price(chain),
      get_auction_yield(chain),
      //  claim_all(chain),
      get_player_lands(chain),
      socialink_lookup,
    ],

  });
}