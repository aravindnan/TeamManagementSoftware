import { LOGIN, LOGOUT } from "../types"


export const loginAction=(userData:any)=>{
    return{
        type:LOGIN,
        payload:userData
    }
}

export const logoutAction=()=>{
    return{
        type:LOGOUT,
    }
}
