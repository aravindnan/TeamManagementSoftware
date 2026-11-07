import React, { useEffect, useState } from "react";
import Logo from "../common/Logo";
import { Link, useNavigate } from "react-router-dom";
import { colors } from "../Constants";
import { ArrowForwardRounded, ReplayRounded, RestartAltRounded, Visibility, VisibilityOff } from "@mui/icons-material";
import ErrorBox from "../common/ErrorBox";
import { getMe, registerUser } from "../services/authServices";
import { errorMessage } from "../services/apiClient";
import APIResponseStatus from "../common/APIResponseStatus";
import { Tooltip } from "@mui/material";
import { useSelector } from "react-redux";

function Register() {
  
  const [showPassword, setShowPassword] = useState<Boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [registerStatus, setRegisterStatus] = useState<string>("not-registered");
  const [apiResponseMessage,setApiResponseMessage] = useState<string>("")

  const navigate = useNavigate()

  useEffect(() => {
    document.title = "TMS • Sign Up";
    getMe().then((me: any) => {
      if (me?._id) navigate("/dashboard");
    });
  }, [navigate]);

  const retryRegister = () => {
    setRegisterStatus("not-registered");
  };
  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(()=>{
    if(myProfiledata?._id){
      navigate("/dashboard")
    }
  },[myProfiledata?._id,navigate])



  const emptyState = {
    firstName: "",
    lastName: "",
    username: "",
    role: "",
    dateOfBirth: "",
    email: "",
    password: "",
    cpassword: "",
  };

  const [registerFormData, setRegisterFormData]: any = useState<any>({
    firstName: "",
    lastName: "",
    username: "",
    role: "",
    dateOfBirth: "",
    email: "",
    password: "",
    cpassword: "",
  });

  const handleInputChange = (e: any) => {
    setRegisterFormData({
      ...registerFormData,
      [e.target.name]: e.target.value,
    });
  };

  const validateBeforeSubmit = () => {

    if (
      !registerFormData.firstName ||
      !registerFormData.lastName ||
      !registerFormData.username ||
      !registerFormData.role ||
      !registerFormData.dateOfBirth ||
      !registerFormData.email ||
      !registerFormData.password ||
      !registerFormData.cpassword
    ) {
      setError("All fields are required");
      return false;
    }

    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerFormData.email)) {
      setError("Invalid email format");
      return false;
    }

    if (registerFormData.password !== registerFormData.cpassword) {
      setError("Passwords do not match");
      return false;
    }

    const currentDate = new Date();
    const birthDate = new Date(registerFormData.dateOfBirth);
    const ageDifference = currentDate.getFullYear() - birthDate.getFullYear();

    // Check if the person is above 18
    if (ageDifference < 18) {
      setError("Age must be 18 or above");
      return false;
    }
    // Add more validation logic based on your requirements

    setError(null); // Reset error if validation passes
    return true;
  };

  const handleSubmit = async () => {
    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setRegisterStatus("register-loading");
      // Perform registration logic here call API
      const { cpassword, ...payload } = registerFormData;
      const res: any = await registerUser(payload);
      if (res?.registerSuccess) {
        setRegisterStatus("register-success");
        setRegisterFormData(emptyState);
        navigate("/login");
      } else {
        setApiResponseMessage(errorMessage(res, "Registration failed"));
        setRegisterStatus("register-failure");
      }
    } else {
      // Display error message
    }
  };

  return (
    <>
      <div className="flex flex-col justify-center py-1 pb-10  mx-auto  md:w-[500px] md:max-w-[500px] md:overflow-y-hidden ">
        <div className="flex justify-center p-2 h-[180px] " data-aos="zoom-in" data-aos-duration="1000">
          <Logo size={"0.5"} color={colors.C11} />
        </div>

        {registerStatus === "not-registered" ? (
          <>
            <div className="flex flex-col gap-2 px-3 py-5 md:p-2">
              <div className="flex flex-col gap-2 md:flex-row">
                <Tooltip title="First Name" placement="left" arrow>
                  <input
                    data-aos="fade-up" data-aos-duration="1000"
                    type="text"
                    className="flex-1 bg-C44 rounded-[8px] p-2 min-h-[46px] text-[14px]"
                    placeholder="First Name"
                    name="firstName"
                    id="firstName"
                    value={registerFormData.firstName}
                    onChange={handleInputChange}
                  />
                </Tooltip>
                <Tooltip title="Last Name" placement="right" arrow>
                  <input
                  data-aos="fade-up" data-aos-duration="1200"
                    type="text"
                    className="flex-1 bg-C44 rounded-[8px] p-2 min-h-[46px] text-[14px]"
                    placeholder="Last Name"
                    name="lastName"
                    id="lastName"
                    value={registerFormData.lastName}
                    onChange={handleInputChange}
                  />
                </Tooltip>
              </div>
              <Tooltip title="Username" placement="top" arrow>
                <input
                  data-aos="fade-up" data-aos-duration="1400"
                  type="text"
                  className="bg-C44 rounded-[8px] p-2 h-[46px] text-[14px]"
                  placeholder="Username"
                  name="username"
                  id="username"
                  value={registerFormData.username}
                  onChange={handleInputChange}
                />
              </Tooltip>
              <div className="flex flex-col justify-between gap-2 md:flex-row">
                <Tooltip title="Role" placement="left" arrow>
                  <input
                  data-aos="fade-up" data-aos-duration="1600"
                    type="text"
                    className="bg-C44 rounded-[8px] p-2 h-[46px] text-[14px]"
                    placeholder="Role"
                    name="role"
                    id="role"
                    value={registerFormData.role}
                    onChange={handleInputChange}
                  />
                </Tooltip>

                <Tooltip title="Date of Birth" placement="right" arrow>
                  <input
                  data-aos="fade-up" data-aos-duration="1800"
                    className="flex-1 bg-C44 rounded-[8px] p-2 h-[46px] text-[14px] cursor-pointer"
                    type="date"
                    name="dateOfBirth"
                    id="dateOfBirth"
                    value={registerFormData.dateOfBirth}
                    onChange={handleInputChange}
                  /> 
                </Tooltip>
              </div>
              <Tooltip title="Email" placement="left" arrow>
                <input
                data-aos="fade-up" data-aos-duration="2000"
                  type="text"
                  className="bg-C44 rounded-[8px] p-2 h-[46px] text-[14px]"
                  placeholder="Email"
                  name="email"
                  id="email"
                  value={registerFormData.email}
                  onChange={handleInputChange}
                />
              </Tooltip>

              <Tooltip title="Password" placement="right" arrow>
                <div
                data-aos="fade-up" data-aos-duration="2200"
                 className="bg-C44 rounded-[8px]  h-[46px] flex flex-row items-center justify-between focus-within:outline focus-within:outline-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    className=" text-[14px] flex-1 bg-C44 focus:outline-none rounded-[8px] p-2 h-[46px]"
                    placeholder="Password"
                    name="password"
                    id="password"
                    value={registerFormData.password}
                    onChange={handleInputChange}
                  />
                  <div
                    onClick={() => setShowPassword(!showPassword)}
                    className="mr-2 cursor-pointer rounded-full p-1 transition hover:bg-[#00000011]"
                  >
                    {showPassword ? (
                      <VisibilityOff
                        fontSize="small"
                        sx={{ color: colors.C11 }}
                      />
                    ) : (
                      <Visibility fontSize="small" sx={{ color: colors.C11 }} />
                    )}
                  </div>
                </div>
              </Tooltip>

              <Tooltip title="Confirm Password" placement="left" arrow>
                <input
                  data-aos="fade-up" data-aos-duration="2400"
                  type="password"
                  className="bg-C44 rounded-[8px] p-2 h-[46px] text-[14px] outline-none focus:outline"
                  placeholder="Confirm Password"
                  name="cpassword"
                  id="cpassword"
                  value={registerFormData.cpassword}
                  onChange={handleInputChange}
                />
              </Tooltip>

              {error ? (
                // Section to implement the logic for validation
                <ErrorBox message={error} />
              ) : null}
            </div>
            <div className="flex justify-center w-full "
            data-aos="fade-up" data-aos-duration="2600"
                              >
              <button
                onClick={handleSubmit}
                className={`bg-C11 hover:bg-[#012B39] rounded-[8px] text-C55 font-bold text-[14px] py-4 px-10 `}
              >
                Sign Up
              </button>
            </div>
            <div className="flex flex-col justify-center gap-2 pb-5 mt-2 md:pb-0" data-aos="fade-up" data-aos-duration="2800">
          <div className="mx-auto" 
 >
          <Link to={"/login"}>
              <div
                className={`text-[11px] text-C22 hover:text-C11 cursor-pointer  text-center py-2 hover:underline underline-offset-1`}
              >
                Already Have an Account? Login
              </div>
            </Link>
          </div>
          <div className="mx-auto ">
          <Link to={"/"}>
            <div
              className={`text-[11px] text-C22 cursor-pointer  text-center  w-fit hover:underline underline-offset-1 hover:text-C11`}
            >
              Home
            </div>
          </Link>
          </div>

          </div>

           
            
          </>
        ) : 
        registerStatus === "register-success" ? (
          <div className="mt-20">
            <APIResponseStatus
              status={true}
              message={"User Registered Successfully"}
            />
            <div className="flex justify-center gap-4 mt-10">
              <button
                className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5 flex flex-row items-center gap-1`}
                onClick={retryRegister}
              >
                <RestartAltRounded sx={{fontSize:18}}/>
                <span>
                Register Again
                </span>
              </button>
              <button
                onClick={() => navigate("/login")}
                className={`hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5 flex flex-row items-center gap-1`}
              >
                <span>Go To Login</span>
                <ArrowForwardRounded sx={{fontSize:18}}/>
              </button>
            </div>
          </div>
        ) : 
        registerStatus === "register-failure" ? (
          <div className="mt-20">
            <APIResponseStatus
              status={false}
              message={apiResponseMessage}
            />
            <div className="flex justify-center gap-4 mt-10">
              <button
                className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5 flex flex-row items-center gap-1`}
                onClick={retryRegister}
              >
                <ReplayRounded  sx={{fontSize:18}}/>
                <span>Try Again</span>
                
              </button>
            </div>
          </div>
        ) : registerStatus === "register-loading" ? (
          <div className="flex justify-center mt-[200px] text-[16px] font-light ">
            <div>{`Registering you ${registerFormData.firstName}. . .`}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default Register;
