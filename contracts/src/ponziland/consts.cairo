use starknet::ContractAddress;

pub const PONZILAND_WORLD_ADDRESS: felt252 = 0x0000000000000000000000000000000000000000000000000000000000000000;
pub const JOHNNY_ADDRESS: felt252 = 0x021d1a7385cac580bc41c8375a440ccad636d097e36ecf6f63ef02d788d7b2e1;

pub const GRID_WIDTH: u64 = 64;
//this % is for tests now
pub const TAX_RATE: u64 = 2;
pub const BASE_TIME: u64 = 3600;
pub const PRICE_DECREASE_RATE: u64 = 2;
pub const TIME_SPEED: u32 = 4;
pub const MAX_AUCTIONS: u8 = 10;
pub const DECAY_RATE: u64 = 100;
//TODO:The floor price can be an u8, depends how we want to handle it
pub const FLOOR_PRICE: u256 = 1;