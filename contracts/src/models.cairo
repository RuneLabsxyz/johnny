use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Introspect)]
pub enum Status {
    None,
    Planting,
    Tending,
    Moving: u64,

}

#[derive(Copy, Drop, Serde, Introspect)]
pub enum Stage {
    Nursery,
    Young,
    Mature
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Johnny {
    // doesn't really matter, meant to be global
    #[key]
    pub address: ContractAddress,
    pub location: u64,
    pub status: Status,
    pub last_action_time: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Orchard {
    #[key]
    pub location: u64,
    pub planted_time: u64,
    pub stage: Stage,
    pub health: u8,
    pub last_tend_time: u64,
}



