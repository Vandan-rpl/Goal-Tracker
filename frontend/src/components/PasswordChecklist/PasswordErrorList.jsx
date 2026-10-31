/**
 * The backend's reasons for rejecting a new password, one per line.
 * Renders nothing for an empty list.
 */
const PasswordErrorList = ({ errors, className = '' }) => {
  if (!errors || errors.length === 0) return null;

  return (
    <ul className={`list-disc pl-5 space-y-0.5 ${className}`}>
      {errors.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

export default PasswordErrorList;
