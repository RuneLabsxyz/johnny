export const balance_query = `query GetTokenBalances {
    tokenBalances(accountAddress:"0x0274b3248dfc7324fa59d59dc21b69b705e3e5e3174f3fb39ee421f5e818dbf4"){
      edges{
        node{
          tokenMetadata{
             ... on ERC20__Token {
              symbol
              amount
              contractAddress
            }
          }
        }
      }
    }
  }`
  
export const auction_query = `query GetActiveAuctions {
    ponziLandAuctionModels(where:{is_finished: false}){
        edges{
        node{
            start_time
            is_finished
            start_price
            floor_price
            land_location
            decay_rate
        }
        }
    }
  }`
  
export const land_query = `query GetOwnedLands {
  ponziLandLandModels(where:{owner:"0x0274b3248dfc7324fa59d59dc21b69b705e3e5e3174f3fb39ee421f5e818dbf4"}){
  edges{
    node{
      location
      stake_amount
      last_pay_time
      sell_price
      token_used
    }
  }
  }
  }`

  export const nuke_query = `query GetNukeableLands {
    ponziLandLandModels(where:{stake_amount: "0"}){
      edges{
        node{
          location
        }
      }
    }
  }`

  export const estimateNukeTime = (
    sellPrice: number,
    remainingStake: number,
    neighbourNumber: number,
  ) => {
    console.log(
      'estimating nuke time',
      sellPrice,
      remainingStake,
      neighbourNumber,
    );
  
    const gameSpeed = 4;
    const taxRate = 0.02;
    const baseTime = 3600;
    const maxNeighbours = 8;
  
    const maxRate = sellPrice * taxRate * gameSpeed;
    const maxRatePerNeighbour = maxRate / maxNeighbours;
    const rateOfActualNeighbours = maxRatePerNeighbour * neighbourNumber;
  
    const remainingHours = remainingStake / rateOfActualNeighbours;
    const remainingSeconds = remainingHours * baseTime;
  
    console.log('estimated seconds', remainingSeconds);
    return remainingSeconds;
  };