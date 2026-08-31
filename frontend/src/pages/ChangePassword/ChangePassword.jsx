import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ChangePassword.css";

import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/Button/Button";
import PasswordInput from "../../components/PasswordInput/PasswordInput";
import goalImage from "../../assets/images/goal.png";
import { changePassword } from "../../api/authApi"; // Ensure this is exported in authApi.js

const ChangePassword = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [passwordData, setPasswordData] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const handleChange = (e) => {
        setPasswordData({
            ...passwordData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError("New password and confirm password do not match.");
            return;
        }

        try {
            setLoading(true);

            await changePassword({
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });

            setSuccessMessage("Password changed successfully! Redirecting to login...");
            
            localStorage.clear();

            setTimeout(() => {
                navigate("/login");
            }, 3000);

       } catch (err) {
    console.error("Error details:", err); // અહીં આખી એરર પ્રિન્ટ થશે
    if (err.response) {
        // સર્વરે રિસ્પોન્સ આપ્યો છે (જેમ કે 400, 401, 500)
        setError(err.response.data.message || "Server Error");
    } else if (err.request) {
        // રિક્વેસ્ટ મોકલાઈ પણ રિસ્પોન્સ નથી આવ્યો (સર્વર બંધ છે કે શું?)
        setError("No response from server. Check if backend is running.");
    } else {
        // બીજી કોઈ એરર
        setError("Error: " + err.message);
    }
} finally {
            setLoading(false);
        }
    };

    const left = (
        <>
            <h1 className="logo">🎯 GOAL TRACKER</h1>
            <h2>Security First.</h2>
            <p>To secure your account, you must change your temporary default password before proceeding to your dashboard.</p>
            <img src={goalImage} className="goal-image" alt="Goal Tracker Security" />
        </>
    );

    const right = (
        <div className="login-box">
            <h2>Change Password</h2>
            <p>Set a secure password for your account</p>

            {error && <p className="error">{error}</p>}
            {successMessage && <p className="success-msg">{successMessage}</p>}

            <form onSubmit={handleSubmit}>
                {/* Manual label added to fix the display issue */}
                <div className="input-field-wrapper">
                    <label>Current Password</label>
                    <PasswordInput
                        name="oldPassword"
                        placeholder="Enter Current Password"
                        value={passwordData.oldPassword}
                        onChange={handleChange}
                    />
                </div>

                <div className="input-field-wrapper">
                    <label>New Password</label>
                    <PasswordInput
                        name="newPassword"
                        placeholder="Enter New Password"
                        value={passwordData.newPassword}
                        onChange={handleChange}
                    />
                </div>

                <div className="input-field-wrapper">
                    <label>Confirm New Password</label>
                    <PasswordInput
                        name="confirmPassword"
                        placeholder="Confirm New Password"
                        value={passwordData.confirmPassword}
                        onChange={handleChange}
                    />
                </div>

                <Button
                    type="submit"
                    title={loading ? "Updating..." : "Update Password"}
                    disabled={loading}
                >
                    {loading ? "Updating..." : "Update Password"}
                </Button>
            </form>
        </div>
    );

    return <AuthLayout left={left} right={right} />;
};

export default ChangePassword;