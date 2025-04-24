use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Land {
    #[key]
    pub location: u64, // 64 x 64 land
    pub block_date_bought: u64,
    pub owner: ContractAddress,
    pub sell_price: u256,
    pub token_used: ContractAddress,
    pub pool_key: ContractAddress, // The Liquidity Pool Key
    //we will use this for taxes
    pub last_pay_time: u64,
    pub stake_amount: u256,
}

#[generate_trait]
impl LandImpl of LandTrait {
    #[inline(always)]
    fn new(
        location: u64,
        owner: ContractAddress,
        token_used: ContractAddress,
        sell_price: u256,
        pool_key: ContractAddress,
        last_pay_time: u64,
        block_date_bought: u64,
        stake_amount: u256,
    ) -> Land {
        Land {
            location,
            owner,
            token_used,
            sell_price,
            pool_key,
            last_pay_time,
            block_date_bought,
            stake_amount
        }
    }
}


#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Auction {
    // id:u64 // this can be the key with location, we have to see if we prefer this or with the
    // start_time
    #[key]
    pub land_location: u16, // 64 x 64 land
    //the start_time can be the other key
    pub start_time: u64,
    pub start_price: u256,
    pub floor_price: u256,
    pub is_finished: bool,
    pub decay_rate: u16,
    pub sold_at_price: Option<u256>,
}

#[generate_trait]
impl AuctionImpl of AuctionTrait {
    #[inline(always)]
    fn new(
        land_location: u16,
        start_price: u256,
        floor_price: u256,
        is_finished: bool,
        decay_rate: u16,
    ) -> Auction {
        Auction {
            land_location,
            start_time: get_block_timestamp(),
            start_price,
            floor_price,
            is_finished,
            decay_rate,
            sold_at_price: Option::None,
        }
    }

    //TODO:REMOVE THIS AFTER TESTS
    #[inline(always)]
    fn get_current_price(self: Auction) -> u256 {
        let current_time = get_block_timestamp();

        let time_passed = if current_time > self.start_time {
            (current_time - self.start_time) * TIME_SPEED.into()
        } else {
            0
        };

        //the price will decrease 2% every 2 minutes (for tests)
        let total_decrease = self.start_price
            * PRICE_DECREASE_RATE.into()
            * time_passed.into()
            / (100 * 120);

        let decremented_price = if self.start_price > total_decrease {
            self.start_price - total_decrease
        } else {
            0
        };

        if decremented_price <= self.floor_price {
            return self.floor_price;
        }

        decremented_price
    }

    // Formula: P(t) = P0 * (1 / (1 + k*t))^2

    // P0:(start_price)
    // m: (floor_price)
    // k: (decay_rate)
    // t: (progress__time)

    #[inline(always)]
    fn get_current_price_decay_rate(self: Auction) -> u256 {
        let current_time = get_block_timestamp();
        let time_passed = if current_time > self.start_time {
            (current_time - self.start_time) * TIME_SPEED.into()
        } else {
            0
        };

        // if the auction has passed a week, the price is 0
        if time_passed >= AUCTION_DURATION.into() {
            return 0;
        }

        let mut current_price: u256 = self.start_price;

        //for the first minutes we use a linear decay
        if time_passed <= LINEAR_DECAY_TIME.into() {
            let time_fraction = time_passed.into() * DECIMALS_FACTOR / LINEAR_DECAY_TIME.into();

            let linear_factor = DECIMALS_FACTOR
                - (DROP_RATE.into() * time_fraction / RATE_DENOMINATOR.into()).into();

            current_price = self.start_price * linear_factor / DECIMALS_FACTOR;
        } else {
            // Scale the time passed by DECIMALS_FACTOR to maintain precision in integer math
            let remaining_rate = RATE_DENOMINATOR - DROP_RATE;
            let price_after_linear = self.start_price
                * remaining_rate.into()
                / RATE_DENOMINATOR.into();

            let progress__time: u256 = (time_passed.into()
                * DECIMALS_FACTOR
                / AUCTION_DURATION.into())
                .into();

            // k is the decay rate (adjusted by DECIMALS_FACTOR for scaling)
            let k: u256 = (self.decay_rate.into() * DECIMALS_FACTOR)
                / SCALING_FACTOR.into(); // 4 * 10^18 / 50

            // Calculate the denominator (1 + k * t) using scaled values for precision
            let denominator = DECIMALS_FACTOR + (k * progress__time / DECIMALS_FACTOR);

            // Calculate the decay factor using the formula (1 / (1 + k * t))^2
            // Ensure denominator is not zero to avoid division by zero errors
            let decay_factor = if denominator != 0 {
                let temp = (DECIMALS_FACTOR * DECIMALS_FACTOR) / denominator;
                (temp * temp) / DECIMALS_FACTOR
            } else {
                0
            };

            current_price = price_after_linear * decay_factor / DECIMALS_FACTOR;
        }

        if current_price > self.floor_price {
            current_price
        } else {
            self.floor_price
        }
    }
}

pub enum LandOrAuction {
    None,
    Land(Land),
    Auction(Auction),
}