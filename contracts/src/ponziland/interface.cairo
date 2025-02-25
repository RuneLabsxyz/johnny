// define the interface
use orchard::ponziland::models::Land;
use starknet::ContractAddress;
#[starknet::interface]
trait IActions<T> {
    //TODO:PASS THIS FUNCTION TO INTERNAL IMPL AFTER TESTS
    fn auction(
        ref self: T,
        land_location: u64,
        start_price: u256,
        floor_price: u256,
        decay_rate: u64,
        is_from_nuke: bool,
    );

    fn bid(
        ref self: T,
        land_location: u64,
        token_for_sale: ContractAddress,
        sell_price: u256,
        amount_to_stake: u256,
        liquidity_pool: ContractAddress,
    );
    fn buy(
        ref self: T,
        land_location: u64,
        token_for_sale: ContractAddress,
        sell_price: u256,
        amount_to_stake: u256,
        liquidity_pool: ContractAddress,
    );

    fn claim(ref self: T, land_location: u64);

    fn nuke(ref self: T, land_location: u64);

    fn increase_price(ref self: T, land_location: u64, new_price: u256);

    fn increase_stake(ref self: T, land_location: u64, amount_to_stake: u256);

    //getters
    fn get_stake_balance(self: @T, staker: ContractAddress) -> u256;
    fn get_land(self: @T, land_location: u64) -> Land;
    fn get_current_auction_price(self: @T, land_location: u64) -> u256;
}