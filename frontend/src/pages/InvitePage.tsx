import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Logo from "../common/Logo";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { GOOGLE_CLIENT_ID } from "../env/environment";
import { colors } from "../Constants";
import { withRedirect } from "../helper/redirect";
import { useInvitePreview, useMe } from "../queries/hooks";
import { NotSignedInError } from "../queries/unwrap";
import { errorMessage } from "../services/apiClient";
import { googleLogin, logoutUser } from "../services/authServices";
import { acceptInviteByToken } from "../services/workspaceServices";

const primary = "bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[14px] py-3 px-8 disabled:opacity-60";
const secondary = "hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[13px] py-2 px-5";

const NOT_PENDING: Record<string, string> = {
  accepted: "This invitation has already been used.",
  revoked: "This invitation was cancelled.",
  expired: "This invitation has expired.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center mx-auto w-[360px] sm:w-[450px] px-3 pb-10 text-C11">
      <div className="flex justify-center p-2 h-[150px]">
        <Logo size={"0.5"} color={colors.C11} />
      </div>
      {children}
    </div>
  );
}

function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const preview = useInvitePreview(token);
  const me = useMe(); // no redirect here: a signed-out visitor is exactly who this page is for
  const [accepting, setAccepting] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const here = `/invite/${token}`;

  React.useEffect(() => {
    document.title = "TMS • Invitation";
  }, []);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    const res: any = await acceptInviteByToken(token);
    setAccepting(false);
    if (res?.workspace) setJoined(res.workspace.name);
    else setError(errorMessage(res, "Could not accept the invitation."));
  };

  const handleGoogle = async (credential: string) => {
    setError(null);
    const res: any = await googleLogin(credential);
    if (res?.success) me.refetch(); // now signed in: the page switches to the accept view
    else setError(errorMessage(res, "Google sign-in failed"));
  };

  const switchAccount = async () => {
    await logoutUser();
    navigate(withRedirect("/login", here));
  };

  if (joined) {
    return (
      <Shell>
        <h1 className="text-[22px] font-extrabold text-center">{`You joined ${joined}`}</h1>
        <p className="text-[13px] text-center mt-2 text-gray-600">You can now be added to its projects and see who else is in the workspace.</p>
        <button className={`${primary} mt-6`} onClick={() => navigate("/dashboard")}>
          Go to your dashboard
        </button>
      </Shell>
    );
  }

  if (preview.isPending) {
    return <Shell><p className="text-[14px] font-light mt-6">Loading invitation...</p></Shell>;
  }

  if (preview.isError || !preview.data) {
    const status = (preview.error as any)?.response?.status;
    return (
      <Shell>
        <h1 className="text-[20px] font-extrabold text-center">{status === 404 ? "This invitation link isn't valid" : "We couldn't load this invitation"}</h1>
        <p className="text-[13px] text-center mt-2 text-gray-600">
          {status === 404 ? "It may have been mistyped or replaced by a newer invitation. Ask the person who invited you for a new link." : errorMessage(preview.error, "Please try again.")}
        </p>
        <div className="flex gap-3 mt-6">
          {status !== 404 && <button className={secondary} onClick={() => preview.refetch()}>Try again</button>}
          <Link to="/dashboard" className={secondary}>Go to dashboard</Link>
        </div>
      </Shell>
    );
  }

  const invite = preview.data;
  const heading = (
    <>
      <h1 className="text-[22px] font-extrabold text-center">You're invited</h1>
      <p className="text-[14px] text-center mt-2">
        <span className="font-bold">{invite.inviterName}</span> invited you to join <span className="font-bold">{invite.workspaceName}</span> as{" "}
        {invite.role === "admin" ? "an admin" : "a member"}.
      </p>
      <p className="text-[12px] text-center mt-1 text-gray-500">{`This invitation is for ${invite.email}`}</p>
    </>
  );

  if (invite.status !== "pending") {
    return (
      <Shell>
        {heading}
        <div role="alert" className="mt-5 rounded-[6px] bg-C44 px-3 py-2 text-[13px] text-center">
          {NOT_PENDING[invite.status] || "This invitation can no longer be used."}
          {invite.status !== "accepted" && ` Ask ${invite.inviterName} to send a new one.`}
        </div>
        <Link to="/dashboard" className={`${secondary} mt-4`}>Go to dashboard</Link>
      </Shell>
    );
  }

  if (me.isPending) return <Shell>{heading}<p className="text-[13px] mt-5 text-gray-500">Checking your session...</p></Shell>;

  const signedOut = me.error instanceof NotSignedInError;
  if (signedOut) {
    return (
      <Shell>
        {heading}
        <p className="text-[13px] text-center mt-5">Sign in or create an account with that email address to accept.</p>
        <div className="flex flex-col items-center gap-3 mt-4 w-full">
          <Link to={withRedirect("/login", here)} className={`${primary} text-center`}>Log in</Link>
          <Link to={withRedirect("/register", here, { email: invite.email })} className={secondary}>Create an account</Link>
          {GOOGLE_CLIENT_ID && (
            <div className="flex flex-col items-center gap-3 w-full mt-1">
              <div className="flex flex-row items-center gap-3 w-full text-[11px] text-gray-500">
                <span className="flex-1 h-[1px] bg-C44" />
                <span>or</span>
                <span className="flex-1 h-[1px] bg-C44" />
              </div>
              <GoogleSignInButton text="continue_with" onCredential={handleGoogle} />
            </div>
          )}
          {error && <div role="alert" className="text-[12px] text-highPriority font-semibold text-center">{error}</div>}
        </div>
      </Shell>
    );
  }

  if (me.isError || !me.data) {
    return (
      <Shell>
        {heading}
        <div role="alert" className="mt-5 text-[13px] text-highPriority font-semibold text-center">{errorMessage(me.error, "Could not check your session.")}</div>
        <button className={`${secondary} mt-3`} onClick={() => me.refetch()}>Try again</button>
      </Shell>
    );
  }

  const myEmail = String(me.data.email || "").toLowerCase();
  if (myEmail !== invite.email) {
    return (
      <Shell>
        {heading}
        <div role="alert" className="mt-5 rounded-[6px] bg-inactiveRed px-3 py-2 text-[13px] text-center text-highPriority font-semibold">
          {`You are signed in as ${myEmail}, but this invitation was sent to ${invite.email}.`}
        </div>
        <button className={`${primary} mt-4`} onClick={switchAccount}>Sign in with a different account</button>
        <Link to="/dashboard" className={`${secondary} mt-2`}>Not now</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      {heading}
      <button className={`${primary} mt-6`} onClick={accept} disabled={accepting}>
        {accepting ? "Joining..." : `Join ${invite.workspaceName}`}
      </button>
      {error && <div role="alert" className="mt-3 text-[12px] text-highPriority font-semibold text-center">{error}</div>}
    </Shell>
  );
}

export default InvitePage;
