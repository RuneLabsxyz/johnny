use starknet::ContractAddress;

#[derive(Drop, Serde, Debug, Copy)]
#[dojo::model]
pub struct Land {
    #[key]
    pub location: u16, // 64 x 64 land
    pub block_date_bought: u64,
    pub owner: ContractAddress,
    pub sell_price: u256,
    pub token_used: ContractAddress,
    //we will use this for taxes
    pub level: Level,
}

#[derive(Serde, Drop, Copy, PartialEq, Introspect, Debug)]
pub enum Level {
    Zero,
    First,
    Second,
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

#[derive(Copy, Drop, Serde, Debug)]
pub enum LandOrAuction {
    None,
    Land: Land,
    Auction: Auction,
}