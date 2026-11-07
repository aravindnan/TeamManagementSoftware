import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../common/Logo'
import { colors } from '../Constants'
import { getMe } from '../services/authServices'
import { useSelector } from 'react-redux'

function HomePage() {
    document.title="TMS • Home"
    const [userData, setUserData]= useState<any>()

    useEffect(()=>{
        getMe().then((me:any)=>{
            if (me?._id) setUserData(me)
        })
    },[])

    const navigate = useNavigate()

    const myProfiledata = useSelector(
        (state: any) => state.authReducer.myUserProfile
      );
    
  return (
    <div>
        <div className='flex flex-row items-center justify-between bg-C44 h-[60px] px-10'>
            <div className='flex items-center justify-center w-10 h-10 ' data-aos="fade-down" data-aos-duration="1000">
            <Logo size={"1"} color={colors.inactiveC11}/>
            </div>


            <div className='flex flex-row items-center gap-8 font-semibold text-[12px] '>
                {
                !userData?
                <>
                <Link to="/register">
                <div className='bg-C11 text-C55 px-4 py-1  rounded-[4px]' data-aos="zoom-in" data-aos-duration="1000">
                    Register
                </div>
                </Link>

                <Link to="/login">
                <div className='hover:bg-inactiveC11 text-C11 px-4 py-1  rounded-[4px]'data-aos="zoom-in" data-aos-duration="1500">
                    Login
                </div>
                </Link>
                 </>: 
                 <Link to={`/dashboard`}>
                 <div className='hover:bg-inactiveC11 text-C11 px-4 py-1  rounded-[4px]'>
                     Dashboard
                 </div>
                 </Link> 
                }

                
            </div>
        </div>

        <div className='h-[300px]   relative mx-auto w-1/2 mt-16 justify-center flex items-center ' 
        data-aos="zoom-in" 
        data-aos-duration="2000"
        >
            <div className='absolute z-[1] animate-circle min-w-[180px] min-h-[180px] bg-C11 speed1 opacity-5'></div>
            <div className='absolute z-[2] animate-circle min-w-[170px] min-h-[170px] bg-C11 speed2 opacity-[0.06]'></div>
            <div className='absolute z-[3] animate-circle min-w-[160px] min-h-[160px] bg-C11 speed3 opacity-5'></div>
            <div className='absolute z-[4] animate-circle min-w-[150px] min-h-[150px] bg-C11 speed4 opacity-[0.06]'></div>
            <div className='absolute z-[5] animate-circle min-w-[140px] min-h-[140px] bg-C11 speed5 opacity-5'></div>
            <div className='absolute z-[6] animate-circle min-w-[130px] min-h-[130px] bg-C11 speed6 opacity-[0.06]'></div>
            <div className='absolute z-[7] animate-circle min-w-[120px] min-h-[120px] bg-C11 speed7 opacity-5'></div>
            <div className='absolute z-[8] animate-circle min-w-[110px] min-h-[110px] bg-C11 speed8 opacity-[0.06]'></div>
            <div className='absolute w-full md:w-3/4 lg:w-1/2 z-[9]'  >
                <Logo color={colors.C11}/>
            </div>
            <div className='absolute z-[10] w-[300px] md:w-fit text-center bottom-[20px] md:left-[32%] lg:left-[38%] text-C11 font-semibold '>Team Management Software</div>
        </div>

        <div className='flex flex-col gap-5 max-w-[90%] md:max-w-[78%] mx-auto text-justify '>
            <div data-aos="fade-in" data-aos-duration="1000" data-aos-once={true}>
            Welcome to our innovative project management platform, a robust 
            solution designed to streamline collaboration and enhance productivity. 
            Our project stems from the vision of simplifying task management, 
            fostering team cohesion, and providing a centralized hub for efficient
             project oversight. In response to the challenges faced in contemporary
              teamwork, our platform integrates advanced features to empower users 
              at every stage of their project lifecycle.
            </div>
            <div data-aos="fade-in" data-aos-duration="1500" data-aos-once={true}>
            Our project management tool offers a comprehensive suite of functionalities. 
            Seamlessly organize tasks, set milestones, and track progress within a 
            user-friendly interface. With dynamic project dashboards, gain real-time
             insights into your team's performance, facilitating informed decision-making. 
             Collaborate effortlessly with team members, assigning tasks and sharing updates 
             to ensure everyone stays on the same page.
            </div>

            <div data-aos="fade-in" data-aos-duration="2000" data-aos-once={true}>
            Furthermore, our platform prioritizes user experience, offering a visually appealing and intuitive design.
             From task prioritization to detailed analytics, our tool is crafted to adapt to the diverse
              needs of project managers, team leads, and individual contributors.
               Embrace a new era of project management, where efficiency meets simplicity,
                and collaboration knows no bounds. Join us on this journey of innovation, where projects 
                evolve seamlessly, and success becomes a collective achievement.
            </div>

        </div>
        

      
    </div>
  )
}

export default HomePage
