import { combineReducers } from "@reduxjs/toolkit";
import { authReducer } from "./reducers/authReducer";
import { notificationReducer } from "./reducers/notificationReducer";

export const rootReducer = combineReducers({
  authReducer,
  notificationReducer,
});
