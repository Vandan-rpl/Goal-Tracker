import "./PasswordInput.css";

const PasswordInput = ({
    name,
    value,
    onChange
}) => {

    return (
        <div className="input-group">

            

            <input
                name={name}
                type="password"
                placeholder="Enter your password"
                value={value}
                onChange={onChange}
            />

        </div>
    );
};

export default PasswordInput;