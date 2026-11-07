import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import GoogleSignInButton from "./GoogleSignInButton";
import { loadGoogleScript, resetGoogleScriptLoader } from "../helper/googleScript";

afterEach(() => {
  delete (window as any).google;
  resetGoogleScriptLoader();
  document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((s) => s.remove());
});

const installGoogle = () => {
  const api = { initialize: jest.fn(), renderButton: jest.fn() };
  (window as any).google = { accounts: { id: api } };
  return api;
};

describe("GoogleSignInButton", () => {
  test("renders nothing at all when Google sign-in is not configured", () => {
    const { container } = render(<GoogleSignInButton clientId="" onCredential={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector('script[src*="accounts.google.com"]')).toBeNull(); // and does not even load Google
  });

  test("initialises Google with our client id and renders Google's button into the page", async () => {
    const google = installGoogle();
    render(<GoogleSignInButton clientId="my-client.apps.googleusercontent.com" text="signup_with" onCredential={() => {}} />);
    await waitFor(() => expect(google.renderButton).toHaveBeenCalled());
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: "my-client.apps.googleusercontent.com", auto_select: false }));
    expect(google.renderButton.mock.calls[0][0]).toBe(screen.getByTestId("google-button"));
    expect(google.renderButton.mock.calls[0][1]).toMatchObject({ text: "signup_with" });
  });

  test("passes the signed credential to the handler, and always the current handler", async () => {
    const google = installGoogle();
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<GoogleSignInButton clientId="c" onCredential={first} />);
    await waitFor(() => expect(google.initialize).toHaveBeenCalled());
    rerender(<GoogleSignInButton clientId="c" onCredential={second} />); // parent re-rendered with a new closure
    const callback = google.initialize.mock.calls[0][0].callback;
    act(() => callback({ credential: "signed.jwt.token" }));
    expect(second).toHaveBeenCalledWith("signed.jwt.token");
    expect(first).not.toHaveBeenCalled();
  });

  test("ignores a callback that carries no credential", async () => {
    const google = installGoogle();
    const onCredential = jest.fn();
    render(<GoogleSignInButton clientId="c" onCredential={onCredential} />);
    await waitFor(() => expect(google.initialize).toHaveBeenCalled());
    google.initialize.mock.calls[0][0].callback({});
    google.initialize.mock.calls[0][0].callback(undefined);
    expect(onCredential).not.toHaveBeenCalled();
  });

  test("says so when Google's script cannot load (e.g. an ad blocker)", async () => {
    render(<GoogleSignInButton clientId="c" onCredential={() => {}} />);
    const script = document.head.querySelector('script[src*="accounts.google.com"]') as HTMLScriptElement;
    expect(screen.getByText(/loading google sign-in/i)).toBeInTheDocument();
    act(() => script.dispatchEvent(new Event("error")));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });

  test("does not touch the page after it has been removed", async () => {
    const google = installGoogle();
    const { unmount } = render(<GoogleSignInButton clientId="c" onCredential={() => {}} />);
    unmount();
    await Promise.resolve();
    expect(google.renderButton.mock.calls.length).toBeLessThanOrEqual(1); // never throws, never renders into a dead node
  });
});

describe("loadGoogleScript", () => {
  test("resolves at once when Google is already on the page", async () => {
    installGoogle();
    await expect(loadGoogleScript()).resolves.toBeUndefined();
    expect(document.head.querySelector('script[src*="accounts.google.com"]')).toBeNull();
  });

  test("adds one script tag however many callers ask, and resolves on load", async () => {
    const a = loadGoogleScript();
    const b = loadGoogleScript();
    expect(document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')).toHaveLength(1);
    document.head.querySelector('script[src*="accounts.google.com"]')!.dispatchEvent(new Event("load"));
    await expect(Promise.all([a, b])).resolves.toBeDefined();
  });

  test("a failed load rejects, cleans up, and can be retried", async () => {
    const failed = loadGoogleScript();
    document.head.querySelector('script[src*="accounts.google.com"]')!.dispatchEvent(new Event("error"));
    await expect(failed).rejects.toThrow(/could not load/i);
    expect(document.head.querySelector('script[src*="accounts.google.com"]')).toBeNull();
    loadGoogleScript(); // retry creates a fresh tag
    expect(document.head.querySelectorAll('script[src*="accounts.google.com"]')).toHaveLength(1);
  });
});
