import "./AuthLayout.css";

const AuthLayout = ({left,right}) =>{

    return(

        <div className="auth-container">

            <div className="left-panel">

                {left}

            </div>

            <div className="right-panel">

                {right}

            </div>

        </div>

    )

}

export default AuthLayout;