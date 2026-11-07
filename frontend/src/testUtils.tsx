import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rootReducer } from "./redux/rootReducer";

/** An isolated client per test: no retries (failures surface immediately) and no GC timers. */
export const makeTestClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } } });

export const makeTestStore = (signedIn = true, profile: any = signedIn ? { _id: "me" } : null) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: { authReducer: { myUserProfile: profile, isAuthenticated: signedIn } } as any,
  });

interface Options {
  client?: QueryClient;
  store?: ReturnType<typeof makeTestStore>;
  route?: string;
}

/** Renders `ui` with Redux, the query cache and a router, returning the pieces tests want to inspect. */
export function renderWithProviders(ui: React.ReactElement, { client = makeTestClient(), store = makeTestStore(), route = "/" }: Options = {}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
  return { client, store, ...render(ui, { wrapper: Wrapper }) };
}

/** Wrapper for renderHook. */
export function hookWrapper(client: QueryClient, store = makeTestStore(), route = "/") {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}
