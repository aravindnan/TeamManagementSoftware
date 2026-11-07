import React, { useEffect, useState } from "react";
import Logo from "../common/Logo";
import { colors } from "../Constants";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {Visibility, VisibilityOff } from "@mui/icons-material";
import ErrorBox from "../common/ErrorBox";
import { googleLogin, loginUser } from "../services/authServices";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { GOOGLE_CLIENT_ID } from "../env/environment";
import { safeRedirect, withRedirect } from "../helper/redirect";
import { useMe } from "../queries/hooks";
import { errorMessage } from "../services/apiClient";
import APIResponseStatus from "../common/APIResponseStatus";
import { Tooltip } from "@mui/material";


function Login() {
  const [showPassword, setShowPassword] = useState<Boolean>(false);
  const [loginStatus,setLoginStatus] = useState<any>("not-loggedin")
  const [error, setError] = useState<string | null>(null);
  const [apiResponseMessage,setApiResponseMessage] = useState<string>("")
  const navigate = useNavigate();
  // Where to go afterwards (e.g. back to an invitation). Only in-app paths are honoured.
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const destination = safeRedirect(redirectParam);


  const retryLogin=()=>{
    setLoginFormData(emptyState)
    setLoginStatus("not-loggedin")
  }

  // Already signed in? Skip the form.
  const { data: me } = useMe();
  useEffect(() => {
    document.title = "TMS • Log In";
  }, []);
  useEffect(() => {
    if (me) navigate(destination);
  }, [me, navigate, destination]);

//   const getMyProfileData =async(myUserId:any)=>{
//     const tempOBJ = await getUserById(myUserId)
//     dispatch(authActions.loginAction(tempOBJ))
// }
 


  useEffect(() => {
    window.scrollTo(0,0)
    const timer = setTimeout(() => {
      setError(null);
    }, 3000);
    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = {
    username: "",
    password: "",
  };

  const [loginFormData, setLoginFormData]: any = useState<any>({
    username: "",
    password: "",
  });

  const handleInputChange = (e: any) => {
    // if enter is pressed  and form is validated then submit the for     
       setLoginFormData({
      ...loginFormData,
      [e.target.name]: e.target.value,
    });
  };

  const validateBeforeSubmit = () => {
    // Check if username and password are not empty
    if (!loginFormData.username.trim()) {
      setError("Username cannot be empty");
      return false;
    } else if (!loginFormData.password.trim()) {
      setError("Password cannot be empty");
      return false;
    }
    return true;
  };

  const handleGoogle = async (credential: string) => {
    setLoginStatus("login-loading")
    const res: any = await googleLogin(credential)
    if (res?.success) {
      navigate(destination)
    } else {
      setLoginStatus("login-failure")
      setApiResponseMessage(errorMessage(res, "Google sign-in failed"))
    }
  }

  const handleSubmit = async() => {
    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setLoginStatus("login-loading")
      // Perform registration logic here call API
      const res: any = await loginUser(loginFormData)
      if (res?.success) {
        setLoginStatus("login-success")
        setApiResponseMessage(res.message)
        navigate(destination)
      } else {
        setLoginStatus("login-failure")
        setApiResponseMessage(errorMessage(res, "Login failed"))
      }
      setLoginFormData(emptyState);
    } else {
      // Display error message
    }
  };

  return (
    <>
      <div className="">
        <div className="flex flex-col justify-center py-[6px] mx-auto w-[360px] sm:w-[450px] mt-5 sm:mt-0">
         
          <div className="flex justify-center p-2 h-[180px]" data-aos="zoom-in" data-aos-duration="1000" >
            <Logo size={"0.5"} color={colors.C11} />
          </div>
          {
          loginStatus==="not-loggedin"?( 
          <>
          <div className="flex flex-col gap-2 p-2 px-3 py-8 mx:px-2">
            <Tooltip title="Username" placement="top" arrow>
              <input
                data-aos="fade-up"
                data-aos-duration="1000"
                type="text"
                className="bg-C44 rounded-[8px] p-2 h-[40px] sm:h-[46px] text-[14px]"
                placeholder="Username"
                name="username"
                id="username"
                value={loginFormData.firstName}
                onChange={handleInputChange}
              />
            </Tooltip>

            <div className="bg-C44 rounded-[8px]  h-[40px] sm:h-[46px] flex flex-row items-center justify-between focus-within:outline focus-within:outline-2"  
            data-aos="fade-up"
                data-aos-duration="1500">
             <Tooltip title="Password" placement="bottom" arrow >

              <input
               
                type={showPassword ? "text" : "password"}
                className=" text-[14px] flex-1 bg-C44 focus:outline-none rounded-[8px] p-2  h-[40px] sm:h-[46px]"
                placeholder="Password"
                name="password"
                id="password"
                value={loginFormData.password}
                onChange={handleInputChange}
              />
             </Tooltip>
              <div
                onClick={() => setShowPassword(!showPassword)}
                className="mr-2 cursor-pointer rounded-full p-1 transition hover:bg-[#00000011]"
              >
                {showPassword ? (
                  <VisibilityOff fontSize="small" sx={{ color: colors.C11 }} />
                ) : (
                  <Visibility fontSize="small" sx={{ color: colors.C11 }} />
                )}
              </div>
            </div>
            {error ? <ErrorBox message={error} /> : null}
          </div>

          <div className="flex justify-center w-full "        
               data-aos="fade-up"
                data-aos-duration="2000">
            <button
              onClick={handleSubmit}
              className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[14px] py-4 px-10 `}
            >
              Log In
            </button>
          </div>
          {GOOGLE_CLIENT_ID && (
            <div className="flex flex-col items-center gap-3 mt-5 px-3">
              <div className="flex flex-row items-center gap-3 w-full text-[11px] text-gray-500">
                <span className="flex-1 h-[1px] bg-C44" />
                <span>or</span>
                <span className="flex-1 h-[1px] bg-C44" />
              </div>
              <GoogleSignInButton text="signin_with" onCredential={handleGoogle} />
            </div>
          )}

          <div className="flex flex-col justify-center gap-3 mt-4"             
                data-aos="fade-up"
                data-aos-duration="2200">
          <div className="mx-auto" >
          <Link to={withRedirect("/register", redirectParam)} >
            <div
              className={`text-[11px] text-[#1F7A8C]  cursor-pointer  text-center  w-fit hover:underline underline-offset-1 hover:text-C11`}
            >
              New to TMS ? Sign Up!
            </div>
          </Link>
          </div>
          <div className="mx-auto">
          <Link to={"/"}>
            <div
              className={`text-[11px] text-[#1F7A8C] cursor-pointer  text-center  w-fit hover:underline underline-offset-1 hover:text-C11`}
            >
              Home
            </div>
          </Link>
          </div>

          </div>
          </>
          ): 
          // loginStatus === "login-success" ? (
          // <div className="mt-20">
          //   <APIResponseStatus
          //     status={true}
          //     message={apiResponseMessage}
          //   />
          //    <div className="flex justify-center gap-4 mt-10">
          //     <Link to={`/dashboard?id=${loginUserId}`}>
          //     <button
          //       className={`hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5 flex flex-row items-center gap-1`}
          //     >
          //       <span>Go To Dashboard</span>
          //       <ArrowForwardRounded sx={{fontSize:18}}/>
                
          //     </button>
          //     </Link>
          //   </div>
          // </div>) 
           loginStatus === "login-failure" ? (
          <div className="mt-20">
            <APIResponseStatus
              status={false}
              message={apiResponseMessage?apiResponseMessage:"Network Error"}
            />
             <div className="flex justify-center gap-4 mt-10">
              <button
                className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
                onClick={retryLogin}
              >
                Try Again ?
              </button>
            </div>
          </div>
        ) : loginStatus === "login-loading" ? (
          <div className="flex justify-center mt-[100px] text-[16px] font-light ">
            <div>Logging In...</div>
          </div>
         
        ) : null
          
          }
        </div>
        {/*Forgot Password Modal  */}
      </div>
    </>
  );
}

export default Login;
