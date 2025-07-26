#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame::pallet] 
pub mod pallet { 
    use super::*; 
    use frame::{pallet, prelude::*};
    use frame::deps::scale_info::TypeInfo;
    use frame::deps::codec::{Encode, Decode, MaxEncodedLen};
    use frame::deps::sp_runtime::RuntimeDebug;
    use sp_std::vec::Vec; // For `Vec` as part of custom struct definitions
    use sp_core::bounded::BoundedVec; // For BoundedVec in storage values
            
    #[pallet::pallet] 
    pub struct Pallet < T > ( _ ); 

    
    //=====Pallet Configuration=====
    
    #[pallet::config] 
    pub trait Config : frame_system :: Config { 
        type RuntimeEvent : From < Event < Self >> + IsType << Self as frame_system :: Config > :: RuntimeEvent >;

        type RuntimeCall: IsType<<Self as frame_system::Config>::RuntimeCall> + From<Call<Self>>; 

        type LocationId: Parameter + Member + Default + Copy + Hash + MaxEncodedLen + TypeInfo + PartialEq + Eq;

        type RobotId: Parameter + Member + Default + Copy + Hash + MaxEncodedLen + TypeInfo + PartialEq + Eq;

        #[pallet::constant]
        type MaxSwarmSize: Get<u32>;

        #[pallet::constant]
        type MaxLocations: Get<u32>;
        type TaskDefinition: Parameter + Member + MaxEncodedLen + TypeInfo + PartialEq + Eq;

        #[pallet::constant]
        type MaxCommandWaitBlocks: Get<BlockNumberFor<Self>>;

        #[pallet::constant]
        type MaxCommandsPerRobot: Get<u32>;

        #[pallet::constant]
        type MaxTasksPerLocation: Get<u32> + TypeInfo;

    }

    //=====Custom Types and Enums=====
    #[derive(Encode, Decode, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    pub enum RobotStatus<LocationId, TaskDefinition> {
        Idle,
        Moving { target_location: LocationId },
        PerformingTask { task: TaskDefinition },
        WaitingForCommand,
        Error,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    #[scale_info(skip_type_params(LocationId, TaskDefinition))]
    pub struct RobotState<LocationId, TaskDefinition> {
        pub current_location: Option<LocationId>,
        pub status: RobotStatus<LocationId, TaskDefinition>,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    #[scale_info(skip_type_params(TaskDefinition, MaxTasksPerLocation))]
    pub struct LocationInfo<TaskDefinition, MaxTasksPerLocation: Get<u32>> {
        pub status: LocationStatus,
        pub tasks_available: BoundedVec<TaskDefinition, MaxTasksPerLocation>,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    pub enum LocationStatus {
        Occupied { robot_id: u32 },
        Available,
        UnderMaintenance,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, MaxEncodedLen, TypeInfo, RuntimeDebug)]
    pub enum Command<LocationId, TaskDefinition> {
        GoToLocation(LocationId),
        PerformTask(TaskDefinition),
        Halt,
        WaitForCommand,
    }

    //=====Pallet Storage=====
    #[pallet::storage]
    #[pallet::getter(fn robots_state)]
    pub type RobotStates<T: Config> = StorageMap<_, Blake2_128Concat, T::RobotId, RobotState<T::LocationId, T::TaskDefinition>>;

    #[pallet::storage]
    #[pallet::getter(fn locations_data)]
    pub type LocationData<T: Config> =
    StorageMap<_, Blake2_128Concat, T::LocationId, LocationInfo<T::TaskDefinition, T::MaxTasksPerLocation>>;

    #[pallet::storage]
    #[pallet::getter(fn command_queue)]
    pub type CommandQueue<T: Config> = StorageMap<_, Blake2_128Concat, T::RobotId, BoundedVec<Command<T::LocationId, T::TaskDefinition>, T::MaxCommandsPerRobot>>;

    #[pallet::storage]
    #[pallet::getter(fn total_active_robots)]
    pub type TotalActiveRobots<T> = StorageValue<_, u32, ValueQuery>;

    //=====Pallet Errors=====
    #[pallet::error]
    #[derive(PartialEq, Clone)]
    pub enum Error<T> {
        ExecutionFailed,
        InvalidRobotId,
        InvalidLocationId,
        TaskNotAvailable
    }


    //=====Pallet Events=====
    #[pallet::event]
    #[pallet::generate_deposit(pub (super) fn deposit_event)]
    pub enum Event<T: Config> {
        RobotMoved {
            robot_id: T::RobotId,
            from_location: T::LocationId,
            to_location: T::LocationId,
        },
        RobotTaskStarted {
            robot_id: T::RobotId,
            location_id: T::LocationId,
            task: T::TaskDefinition,
        },
        RobotTaskCompleted {
            robot_id: T::RobotId,
            location_id: T::LocationId,
            task: T::TaskDefinition,
            success: bool,
        },
        CommandIssued {
            robot_id: Option<T::RobotId>,
            command: Command<T::LocationId, T::TaskDefinition>,
            commander: T::AccountId,
        },
        RobotStatusUpdated {
            robot_id: T::RobotId,
            new_status: RobotStatus<T::LocationId, T::TaskDefinition>,
        },
        RobotWaitingForCommand {
            robot_id: T::RobotId,
            location_id: T::LocationId,
        },
        RobotError {
            robot_id: T::RobotId,
            error_details: Error<T>,
        }
    }

}