import { combineReducers } from "@reduxjs/toolkit";
import { authReducer } from "./reducers/authReducer";

export const rootReducer = combineReducers({
  authReducer,
});
