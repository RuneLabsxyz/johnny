use starknet::{ContractAddress, get_block_timestamp};

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

#[generate_trait]
pub impl JohnnyImpl of JohnnyTrait {
    fn time_until_act(self: @Johnny) -> u64 {
        let time_passed = get_block_timestamp() - *self.last_action_time;
        match self.status {
            Status::None => {
                return 0;
            },
            Status::Planting => {
                return 600 - time_passed;
            },
            Status::Tending => {
                return 6000 - time_passed;
            },
            Status::Moving => {
                return 60000 - time_passed;
            },
        }
    }

    fn can_act(self: @Johnny) -> bool {
        return self.time_until_act() == 0;
    }

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
    // if it stays healthy for x amount of time, it will grow to the next stage
    pub time_healthy: u64,
}

#[generate_trait]
pub impl OrchardImpl of OrchardTrait {

    fn new(location: u64, time_stamp: u64) -> Orchard {
        return Orchard {
            location: location,
            planted_time: time_stamp,
            stage: Stage::Nursery,
            health: 100,
            last_tend_time: time_stamp,
            time_healthy: 0,
        };
    }

   fn get_health(self: @Orchard, time: u64) -> u8 {
        //TODO CALCULATE HEALTH BASED ON TIME + STAGE
        return *self.health;
   }

   fn tend(ref self: Orchard, time: u64) {

        if self.health < 80 {
            self.time_healthy = 0;
        } else {
            self.time_healthy += (time - self.last_tend_time);
        }

        self.last_tend_time = time;

   }



}