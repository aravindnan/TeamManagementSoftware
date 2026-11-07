import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import InvitationsBanner from "./InvitationsBanner";
import { acceptInviteById, declineInviteById, getMyInvites } from "../services/workspaceServices";
import { renderWithProviders } from "../testUtils";

jest.mock("../services/workspaceServices", () => ({ getMyInvites: jest.fn(), acceptInviteById: jest.fn(), declineInviteById: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const invite = (o: any = {}) => ({ _id: "i1", workspaceName: "Acme Co", inviterName: "Bo Boss", role: "member", status: "pending", ...o });
beforeEach(() => {
  (getMyInvites as jest.Mock).mockReset();
  (acceptInviteById as jest.Mock).mockReset();
  (declineInviteById as jest.Mock).mockReset();
});

test("renders nothing when there are no invitations", async () => {
  (getMyInvites as jest.Mock).mockResolvedValue([]);
  const { container } = renderWithProviders(<InvitationsBanner />);
  await waitFor(() => expect(getMyInvites).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

test("lists who invited you to what, with the role", async () => {
  (getMyInvites as jest.Mock).mockResolvedValue([invite(), invite({ _id: "i2", workspaceName: "Side Gig", inviterName: "Cy", role: "admin" })]);
  renderWithProviders(<InvitationsBanner />);
  expect(await screen.findByText("You have 2 invitations")).toBeInTheDocument();
  expect(screen.getByText("Bo Boss")).toBeInTheDocument();
  expect(screen.getByText("Side Gig")).toBeInTheDocument();
  expect(screen.getByText(/as an admin/)).toBeInTheDocument();
});

test("uses the singular for one invitation", async () => {
  (getMyInvites as jest.Mock).mockResolvedValue([invite()]);
  renderWithProviders(<InvitationsBanner />);
  expect(await screen.findByText("You have an invitation")).toBeInTheDocument();
});

test("accepting and declining call the server for that invitation", async () => {
  (getMyInvites as jest.Mock).mockResolvedValue([invite(), invite({ _id: "i2", workspaceName: "Side Gig" })]);
  (acceptInviteById as jest.Mock).mockResolvedValue({ workspace: { _id: "w1", name: "Acme Co" } });
  (declineInviteById as jest.Mock).mockResolvedValue({ declined: true });
  renderWithProviders(<InvitationsBanner />);
  fireEvent.click(await screen.findByRole("button", { name: "Accept the invitation to Acme Co" }));
  await waitFor(() => expect(acceptInviteById).toHaveBeenCalledWith("i1"));
  fireEvent.click(screen.getByRole("button", { name: "Decline the invitation to Side Gig" }));
  await waitFor(() => expect(declineInviteById).toHaveBeenCalledWith("i2"));
});

test("a refusal is shown, and the invitation stays", async () => {
  (getMyInvites as jest.Mock).mockResolvedValue([invite()]);
  (acceptInviteById as jest.Mock).mockResolvedValue({ isAxiosError: true, response: { data: { error: "This invitation is no longer valid" } } });
  renderWithProviders(<InvitationsBanner />);
  fireEvent.click(await screen.findByRole("button", { name: /Accept the invitation/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("no longer valid");
  expect(screen.getByRole("button", { name: /Accept the invitation/ })).toBeEnabled();
});
