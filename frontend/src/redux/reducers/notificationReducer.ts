import { LOGOUT, SET_UNREAD } from "../types"

const initialState = { unread: 0 }

export const notificationReducer = (state = initialState, action: any) => {
  switch (action.type) {
    case SET_UNREAD:
      return { ...state, unread: action.payload }
    case LOGOUT:
      return initialState
    default:
      return state
  }
}
