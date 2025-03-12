import { render } from "../../fork/daydreams/packages/core/src";
import { env } from "../env";
import manifest from "../manifest.json";
import { Contract, RpcProvider, type Abi } from "starknet";
import manifest_sepolia from "../contracts/manifest_sepolia.json";

let provider = new RpcProvider({ nodeUrl: env.STARKNET_RPC_URL });
let abi = manifest.contracts[0].abi;

let orchard_abi = manifest_sepolia.contracts[0].abi;
console.log(orchard_abi);

const address = env.STARKNET_ADDRESS;

const ponzilandAddress = '0x1f058fe3a5a82cc12c1e38444d3f9f3fd3511ef4c95851a3d4e07ad195e0af6';
const estarkAddress = '0x71de745c1ae996cfd39fb292b4342b7c086622e3ecf3a5692bd623060ff3fa0';
const ebrotherAddress = '0x7031b4db035ffe8872034a97c60abd4e212528416f97462b1742e1f6cf82afe';
const elordsAddress = '0x4230d6e1203e0d26080eb1cf24d1a3708b8fc085a7e0a4b403f8cc4ec5f7b7b';
const epaperAddress = '0x335e87d03baaea788b8735ea0eac49406684081bb669535bb7074f9d3f66825'

// read abi of Test contract
const { abi: estarkAbi } = await provider.getClassAt(estarkAddress);
const { abi: ebrotherAbi } = await provider.getClassAt(ebrotherAddress);
const { abi: elordsAbi } = await provider.getClassAt(elordsAddress);
const { abi: epaperAbi } = await provider.getClassAt(epaperAddress);

const estarkContract = new Contract(estarkAbi, estarkAddress, provider);
const ebrotherContract = new Contract(ebrotherAbi, ebrotherAddress, provider);
const elordsContract = new Contract(elordsAbi, elordsAddress, provider);
const epaperContract = new Contract(epaperAbi, epaperAddress, provider);
let ponziLandContract = (new Contract(abi, manifest.contracts[0].address, provider)).typedv2(abi as Abi);


let block_time = (await provider.getBlock()).timestamp;


let ORCHARD_CONTEXT = `

You should regulalaly monitor your lands stake and price relative to its neighbors, and keep an eye out for auctions and cheap lands.
<contract_addresses>
  - your address: 0x07480be1854e8464b85b7310d1f9602d810674e2bc43a3d73a168c816a2bbd8a
  - orchard-johnny_actions: 0x792716cdd575f8150e7a25fbca4599210f2318cb6887e577a1e88217ae451fe
  
</contract_addresses>

<state>

Here is a how you obtain the current state of the game: 
Remember all token balances are in wei, so the true value is 10^18 times the value in the state.
Remember that if you want to buy a land, you would query neighbors, and if you want to bid on an auction you would query auctions.
ALL LANDS CAN BE BOUGHT FOR THEIR LISTED SELL PRICE IN THEIR STAKED TOKEN

<IMPORTANT_RULES>
- DO NOT fetch auctions when a user wants to buy a land, only fetch neighbors.
- Buying a land is NOT AN AUCTION, it is a direct purchase into a neighboring land.
- Be careful to use the correct querys for the request, and only use querys that are relevant to the request.
</IMPORTANT_RULES>

<querys>
  lands - returns the remaining stake, price, and token of all lands you own
  claims - shows the claimable yield from all your lands
  neighbors - shows the neighbors of all your lands, including if they are nukeable and their sell price
  auctions - shows the current auction price of all auctions 
  nukeable_lands - shows all lands that are out of stake
</querys>

<API_GUIDE>

<IMPORTANT_RULES>
1. If you receive an error, you may need to try again, the error message should tell you what went wrong.
2. To verify a successful transaction, read the response you get back. You don't need to query anything.
3. Never include slashes in your calldata.
4. Remember all token values are in wei so, so remember that the amount used in function calls is the 10^18 * the value relative to the state.
5. Make sure to approve the token for the ponziland-actions contract before bidding for all tokens and for the correct amount.
6. Remember you can call multiple functions in the same transaction, like approve and bid, but only bid on one land at a time.
7. If you are going to nuke a land, make sure that you only nuke a single land in a transaction, and include nothing else.
8. You can bundle multiple claims together, or bundle approves with other transactions, but try to only do one thing at a time.
9. Remember that all lands can be bought for their listed sell price in their staked token, even if there is not an auction.
10. DO NOT CHECK AUCTIONS AGAIN IN RESPONSE TO A FAILED BID
</IMPORTANT_RULES>


  <EXECUTE_TRANSACTION_INFORMATION>
    Remember that you can make multiple function calls in the same transaction.
    This means EXECUTE_TRANSACTION should only ever be called once per output, and should include all calls as an array.
    You should keep calls to a minimum, and only try to do one thing at a time. 
    If you include multiple transactions that spend tokens, make sure to approve enough for all of them
  </EXECUTE_TRANSACTION_INFORMATION>

  </API_GUIDE>

`;

export const CONTEXT = render(ORCHARD_CONTEXT, {});
