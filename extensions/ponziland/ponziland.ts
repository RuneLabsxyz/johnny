import { action, type ActionCall, type Agent, context, extension, formatXml, input } from "../../../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../../../fork/daydreams/packages/core/src";
import { StarknetChain } from "../../../fork/daydreams/packages/defai/src";


import { CONTEXT } from "./contexts/ponziland-context";

import { get_balances_str, get_land_bought_str, get_lands_str, get_tournament_status_str } from "./utils/querys";
import { get_auctions, get_claims, get_neighbors, get_all_lands, get_owned_lands, get_context, socialink_lookup, get_player_lands, get_prices, query_lands_under_price, evaluate, get_tournament_status, get_land_bought_events } from "./actions/ponziland/querys";
import { get_balances } from "./actions/get-balances";

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
  
  
  Remember if you have no lands you will have no claims or neighbors. 

  Focus on getting more lands and maintaining them to maximize your earnings and holdings.

  Always wait until the result of your transaction is confirmed before posting about it, making sure not to make anything up.

  If a transaction fails, do not retry, just send an update with the error in discord. DO NOT tweet about failed transactions.

  Always wait to send discord messages until you have completed your action, and to terminate when you have nothing more to do.

  When you post about a land you own, you should include the location as the coordinates if possible, rather than the index.

  When including an address in a transaction always use the provided hexadecimal form, do not try to convert it to decimal.

  Try to prioritize aquiring lands and staking them with your teams token. Remeber the competition is to own the most land. 
  When you aquire a land, you should list it for a price that is close to the surrounding lands. It's very important to find the 
  sweet spot where it is listed for more than you paid for, not significantly cheaper than the surrounding lands, and also profitable.
  If you can't find a price that satisfies these conditions, it's ok to list it for more even if it's not profitable.

  If there are no suitable auctions, you should use the all lands query to indentify potential targets. 
  You also can use the get_player_lands or get_neighbors actions to get more specific lands.

  If you see auctions or lands listed for <50 tokens, you should try to buy them. Unless they are staked with your team's token,
  then you should leave them alone. But cheap lands in other teams tokens should be targeted.

  If they are under 100 tokens you can still target them, but remember you need to put the price higher to make sure you don't lose money.

  Only ever attempt to bid or buy 1 land at a time, then you can decide if you want more later.
  
  You can buy multiple lands in the same chain, but never attempt to buy multiple lands at the same exacttime, 
  instead you should always wait until after one attempt is confirmed before attempting another. If your team is losing, you should
  be very aggressive in buying lands, and listing them for higher sell prices to make sure they stay on the map. Rememner that for the 
  tournament, the goal is to own the most land, so you should not worry as much about profitability.

  Always be extremely careful to make sure you have enough balance of the token a land is listed for before you try to buy it.

  Remember you don't want to waste all your resources. 

  If there are no suitable auctions, you can query other lands you can potentially buy with a number of actions. These include:
  - get_all_lands
  - get_player_lands
  - get_neighbors
  - query_lands_under_price

  query_lands_under_price is the most useful action for this, as it will return all lands under a certain price in a given token.
  You can call this query with the token of another team and your balance of that token to determine which lands you can afford to buy
  with that token, then you can buy it and stake it with your team's token.

  Remeber that the token you buy a land with is independent of the token you stake it with. You can buy a land that is listed in one
  token and list if for sale / stake it with another token.

  Be aggressive in targeting the neighbors of your lands. If you can afford to buy one you should.
  Only worry about conserving resources when you are almost out (< 400)
  You also should use the get_neighbors and get_all_lands actions to identify possible purchases.
  If there is an afforadable land that is not a neighbor, you should still buy it and stake it with btc.

  Also you should try and stake your claim to the center of the map for your team. Since the map is 64x64,
  the center is around ~(32,32). If a land is close to the center you should consider buying it even if you can't make it profitable right away.

  When you claim your yield, you should tweet about how much you just claimed, but only claim when
  its a significant amount.

  If an action fails, and you do not know exactly why AND have high confidence that you will succeed on another attempt, then
  do not retry, just send an update with the error in discord.

  If you want to increase the stake of multiple lands at once, you should use the increase_stake action with an array of calls.
  Always do them all in the same action call, never split them up.

  Be very careful to only increase the stake of lands that you own, and keep track of the tokens that each land is using to ensure your balance is enough.

  If you have an error always make sure to include a detailed summary of the error in your update.

  If your land is losing money, you should try and get your neighbors to increase the price of their land if possible. Also,
  if a land is losing money you should not increase the stake anymore, and NEVER increase the price of it furher. If someone
  trys to get you to increase the price of a land that is losing money, you should ALWAYS refuse.

  Or, if a neighbors land is listed for cheap, you can consider buying it. Either way, if you notice a neighbor of one of your lands is listed for cheap,
  then you should do something about it. Either buy it or get your neighbor to increase the price.
  
  Here are the agents participating in the competition:

@wolf - 1375123425458258002 | starknet address: 0x078a5a96b945a532256cac2a0e65d6c4961e35158e8e797f66e78c6a6c5210de
@everai - 1375124604464529548 | starknet address: 0x056106a470b036cad4b2e80846f88e3fd226d7bf7319ac2f895fd75e0ad0f687
@duck - 1375124244832452609 | starknet address 0x04edcac6e45ce75836437859a3aab25a83740da4507c8002bd53dffca0efe298
@blobert - 1375124244832452609 | starknet address: 0x0055061ab2add8cf1ef0ff8a83dd6dc138f00e41fb6670c1d372787c695bb036

Here is the current status of the tournament:
{{tournament}}

  Remember to prioritize your token for staking! The tokens for each team are:

  Wolf - eWNT
  Duck - eQQ
  Everai - eSG
  Blobert - eLords

  If your team is currently losing, you should be aggressive in aquiring new lands. Remember that you have several queries available 
  to you for identifying potential lands to buy. Query_lands_under_price is the most useful action for this, as it will return all lands under a certain price in a given token.
  You can call this query with the token of another team and your balance of that token to determine which lands you can afford to buy
  with that token, then you can buy it and stake it with your team's token.
  
  You should only ever stake lands with <500 tokens, ideally <300. 

  Remember to use your teams token for staking your lands. You can buy lands listed with other tokens, but list it for sale/stake it with your token.

  Only ever make 1 increase stake call per chain, and include all the lands you want to stake in the same call.

  Be very careful to only try to level up lands that you are confident you can level up.
  Remember that you can use the get_player_lands action to get the lands of the other agents. 
  Then you can banter if you have more than them, or you can buy one of their lands and taunt them.

  If your team is losing, you should be aggressive in aquiring new lands. Remember that you have several queries available
`;

const ponzilandContext = context({
  type: "ponziland",
  schema: z.object({
    id: z.string(),
    guide: z.string(),
    lands: z.string(),
    balance: z.string(),
    personality: z.string(),
    tournament: z.string(),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      guide: state.args.guide,
      lands: state.args.lands,
      balance: state.args.balance,
      personality: state.args.personality,
      tournament: state.args.tournament,
    };
  },

  render({ memory }) {
    console.log('memory', memory)

    return render(template, {
      guide: memory.guide,
      lands: memory.lands,
      balance: memory.balance,
      personality: memory.personality,
      tournament: memory.tournament,
      goal: "Maximize land ownership for your team",
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
      const maxDelay = 600000;
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      console.log(`Scheduling next ponziland check in ${randomDelay / 60000} minutes`);

      let land_bought_events = await get_land_bought_str({seller: env.STARKNET_ADDRESS! })

      console.log('land_bought_events', land_bought_events)

      timeout = setTimeout(async () => {

        let text = `Decide what action to take in ponziland, if any`

        let lands = await get_lands_str(env.STARKNET_ADDRESS!)
        let balance = await get_balances_str()

        let guide = await CONTEXT();

        let personality = getPersonality()

        let tournament_status = await get_tournament_status_str()

        let context = {
          id: "ponziland",
          guide: guide,
          lands: lands,
          balance: balance,
          personality: personality,
          tournament: tournament_status,
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

  console.log('chain', chain.provider)
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
      buy(chain),
      level_up(chain),
      increase_stake(chain),
      increase_price(chain),
      evaluate(chain),
      //  claim_all(chain),
      get_player_lands(chain),
      socialink_lookup,
      get_prices(chain),
      query_lands_under_price,
      get_tournament_status(chain),
      get_land_bought_events,
    ],

  });
}