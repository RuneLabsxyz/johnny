use orchard::models::{Johnny, Orchard};

#[starknet::interface]
trait IJohnnyActions<T> {
    fn move(ref self: T, location: u64);
    fn plant(ref self: T);
    fn tend(ref self: T);
    fn refresh(ref self: T);
    fn get_johnny(self: @T) -> Johnny;
    fn get_johnny_location(self: @T) -> (u64, u64);
    // returns Johnny, the neighbor locations, the time until Johnny can act, and the orchard at Johnny's location
    fn get_status(self: @T) -> (Johnny, Array<u64>, u64, Option<Orchard>);
    fn get_orchard(self: @T, location: u64) -> Option<Orchard>;
    fn get_neighbor_indexs(self: @T, location: u64) -> Array<u64>;
    fn get_neighbor_coords(self: @T, location: u64) -> Array<(u64, u64)>;
    fn get_neighboring_orchards(self: @T, location: u64) -> Array<Orchard>;
}

#[dojo::contract]
mod johnny_actions {
    use super::{IJohnnyActions};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use orchard::ponziland::consts::JOHNNY_ADDRESS;
    use orchard::ponziland::coords::{left, right, up, down, get_neighbors_indexs, get_neighbors_coords};
    use orchard::models::{Johnny, JohnnyTrait, Status, Orchard, OrchardTrait, Stage};
    use orchard::ponziland::coords::index_to_position;

    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;

    pub fn namespace() -> @ByteArray {
        @"orchards2"
    }

    fn dojo_init(ref self: ContractState) {

        let mut world = self.world(namespace());

        let johnny = Johnny {
            address: starknet::contract_address_const::<JOHNNY_ADDRESS>(),
            location: 70,
            status: Status::None,
            last_action_time: get_block_timestamp(),
        };

        world.write_model(@johnny);
    }

    #[abi(embed_v0)]
    impl JohnnyActionsImpl of IJohnnyActions<ContractState> {
        fn move(ref self: ContractState, location: u64) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");
            let mut world = self.world(namespace());
            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            assert!(_can_act(johnny), "Johnny cannot act");

            //TODO: HANDLE UNWRAP SAFELY
            let valid = location == left(johnny.location).unwrap() || 
                location == right(johnny.location).unwrap() || 
                location == up(johnny.location).unwrap() || 
                location == down(johnny.location).unwrap();

            johnny.status = Status::Moving(location);
            johnny.last_action_time = get_block_timestamp();
            assert!(valid, "Invalid move");

            //TODO: MOVE AFTER 
            johnny.location = location;
            world.write_model(@johnny);
        }

        fn plant(ref self: ContractState) {
            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");
            let mut world = self.world(namespace());
            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            assert!(_can_act(johnny), "Johnny cannot act");

            let mut orchard: Orchard = world.read_model(johnny.location);

            assert!(orchard.planted_time == 0, "Orchard already planted here");

            johnny.status = Status::Planting;
            johnny.last_action_time = get_block_timestamp();

            world.write_model(@orchard);
            world.write_model(@johnny);
        }

        fn tend(ref self: ContractState) {

            let caller = get_caller_address();
            assert!(caller.into() == JOHNNY_ADDRESS, "Not Johnny");
            let mut world = self.world(namespace());

            let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

            assert!(_can_act(johnny), "Johnny cannot act");

            let mut orchard: Orchard = world.read_model(johnny.location);

            assert!(orchard.planted_time != 0, "Orchard not planted");

            johnny.status = Status::Tending;
            johnny.last_action_time = get_block_timestamp();

            orchard.last_tend_time = get_block_timestamp();
            orchard.health = 100;

            world.write_model(@orchard);
            world.write_model(@johnny);
        }

        fn refresh(ref self: ContractState) {
            let res = _refresh_johnny(ref self);
            
        }

        fn get_johnny(self: @ContractState) -> Johnny {
            let mut world = self.world(namespace());
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            return johnny;
        }

        fn get_johnny_location(self: @ContractState) -> (u64, u64) {
            let mut world = self.world(namespace());
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            return index_to_position(johnny.location);
        }

        fn get_orchard(self: @ContractState, location: u64) -> Option<Orchard> {
            let mut world = self.world(namespace());
            let orchard: Orchard = world.read_model(location);
            if orchard.planted_time == 0 {
                return Option::None;
            }
            return Option::Some(orchard);
        }

        fn get_status(self: @ContractState) -> (Johnny, Array<u64>, u64, Option<Orchard>) {
            let mut world = self.world(namespace());
            let johnny: Johnny = world.read_model(JOHNNY_ADDRESS);
            let orchard: Orchard = world.read_model(johnny.location);

            let neighbors = _get_neighbors(johnny.location);

            let time_until_act = johnny.time_until_act();

            if orchard.planted_time == 0 {
                return (johnny, neighbors, time_until_act, Option::None);
            }
            return (johnny, neighbors, time_until_act, Option::Some(orchard));
        }

        fn get_neighbor_indexs(self: @ContractState, location: u64) -> Array<u64> {
            return get_neighbors_indexs(location);
        }

        fn get_neighbor_coords(self: @ContractState, location: u64) -> Array<(u64, u64)> {
            return get_neighbors_coords(location);
        }

        fn get_neighboring_orchards(self: @ContractState, location: u64) -> Array<Orchard> {
            let mut orchards = array![];
            let world = self.world(namespace());
            let neighbors = get_neighbors_indexs(location);
            for neighbor in neighbors {
                let orchard: Orchard = world.read_model(neighbor);
                if orchard.planted_time != 0 {
                    orchards.append(orchard);
                }
            };
            return orchards;
        }

    }

    fn _can_act(johnny: Johnny) -> bool {
        let time_passed = get_block_timestamp() - johnny.last_action_time;

        match johnny.status {
            Status::None => true,
            Status::Planting => {
                time_passed > 600
            },
            Status::Tending => {
                time_passed > 6000
            },
            Status::Moving => {
                time_passed > 60000
            },
        }
    }

    fn _refresh_johnny(ref self: ContractState) -> bool {
        let mut world = self.world(namespace());
        let mut johnny: Johnny = world.read_model(JOHNNY_ADDRESS);

        let can_act = _can_act(johnny);

        if johnny.location == 0 {
            johnny = Johnny {
                address: starknet::contract_address_const::<JOHNNY_ADDRESS>(),
                location: 70,
                status: Status::None,
                last_action_time: get_block_timestamp(),
            };
        }

        if can_act {
            match johnny.status {
                Status::None => {

                },
                Status::Planting => {
                    let mut orchard: Orchard = OrchardTrait::new(johnny.location, get_block_timestamp());
                    world.write_model(@orchard);
                },
                Status::Tending => {
                    let mut orchard: Orchard = world.read_model(johnny.location);
                    orchard.last_tend_time = get_block_timestamp();
                    orchard.health = 100;
                    world.write_model(@orchard);
                },
                Status::Moving(location) => {
                    johnny.location = location;

                },
            }

            johnny.status = Status::None;

            world.write_model(@johnny);
        }

        return can_act;
    }

    fn _get_neighbors(location: u64) -> Array<u64> {
        let mut neighbors = array![];

        if let Option::Some(left) = left(location) {
            neighbors.append(left);
        }
        if let Option::Some(right) = right(location) {
            neighbors.append(right);
        }
        if let Option::Some(up) = up(location) {
            neighbors.append(up);
        }
        if let Option::Some(down) = down(location) {
            neighbors.append(down);
        }

        return neighbors;
    }

    fn _check_valid_move(start: u64, to: u64) -> bool {
        if let Option::Some(left) = left(start) {
            if left == to {
                return true;
            }
        }
        if let Option::Some(right) = right(start) {
            if right == to {
                return true;
            }
        }
        if let Option::Some(up) = up(start) {
            if up == to {
                return true;
            }
        }
        if let Option::Some(down) = down(start) {
            if down == to {
                return true;
            }
        }
        return false;
    }
}
