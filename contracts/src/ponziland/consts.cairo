use starknet::ContractAddress;

pub const PONZILAND_WORLD_ADDRESS: felt252 = 0x0000000000000000000000000000000000000000000000000000000000000000;
pub const JOHNNY_ADDRESS: felt252 = 0x0274b3248dfc7324fa59d59dc21b69b705e3e5e3174f3fb39ee421f5e818dbf4;

pub const GRID_WIDTH: u16 = 64;
//this % is for tests now
pub const TAX_RATE: u64 = 2;
pub const BASE_TIME: u64 = 3600;
pub const PRICE_DECREASE_RATE: u64 = 2;
pub const TIME_SPEED: u32 = 4;
pub const MAX_AUCTIONS: u8 = 10;
pub const DECAY_RATE: u64 = 100;
//TODO:The floor price can be an u8, depends how we want to handle it
pub const FLOOR_PRICE: u256 = 1;