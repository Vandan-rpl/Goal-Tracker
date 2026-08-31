import "./Button.css";

const Button = ({ children, onClick, type = "button", title }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className="btn-primary"
      title={title}
    >
      {children}
    </button>
  );
};

export default Button;