import { LOGIN, LOGOUT } from "../types"

const authInitialState = {
    myUserProfile: null,
    isAuthenticated: false,
  };
  
export const authReducer=(state=authInitialState,action:any)=>{
  switch (action.type) {
    case LOGIN:
      return {
        ...state,
        myUserProfile: action.payload,
        isAuthenticated: true,
      };
    case LOGOUT:
      return {
        ...state,
        myUserProfile: null,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}
