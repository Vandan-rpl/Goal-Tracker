import "./Input.css";

const Input = ({
    label,
    name,
    type,
    placeholder,
    value,
    onChange
}) => {

    return (
        <div className="input-group">

            <label>
                {label}
            </label>

            <input
                name={name}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />

        </div>
    );
};

export default Input;