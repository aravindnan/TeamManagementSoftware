import { SET_UNREAD } from "../types"

export const setUnreadAction = (count: number) => ({
  type: SET_UNREAD,
  payload: Math.max(0, count),
})
