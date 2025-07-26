#![cfg_attr(not(feature = "std" ), no_std)] 
pub use pallet :: * ; 

#[frame::pallet] 
pub mod pallet { 
    use super :: * ; 
    use frame :: prelude :: * ; 
    
    #[pallet::pallet] 
    pub struct Pallet < T > ( _ ); 
    
    #[pallet::config] 
    pub trait Config : frame_system :: Config { 
        type RuntimeEvent : From < Event < Self >> + IsType << Self as frame_system :: Config > :: RuntimeEvent >;

        type RuntimeCall: IsType<<Self as frame_system::Config>::RuntimeCall> + From<Call<Self>>; 

        type WeightInfo: WeightInfo;

        #[pallet::constant]
        type LocationId: Parameter + Member + Default + Copy + Has + MaxEncodedLen + TypeInfo;

        type RobotId: Parameter + Member + Default + Copy + MaxEncodedLen + TypeInfo;

        #[pallet::constant]
        type MaxSwarmSize: Get<u32>;

        #[pallet::constant]
        type MaxLocations: Get<u32>;
        type TaskDefinition: Parameter + Member + TypeInfo;

        #[pallet::constant]
        type MaxCommandWaitBlocks: Get<BlockNumberFor<Self>>;
    }
}