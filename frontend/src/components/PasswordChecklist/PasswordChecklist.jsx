import { Check, X } from 'lucide-react';
import {
  checkPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_CHAR_TYPES,
  PASSWORD_MIN_LENGTH,
} from '../../utils/passwordPolicy';

const Item = ({ met, children }) => (
  <li className={`flex items-start gap-2 ${met ? 'text-green-700' : 'text-slate-500'}`}>
    {met ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
    <span>{children}</span>
  </li>
);

/**
 * Live checklist under a new-password field. Guidance only; the backend
 * decides, and its messages are shown separately when it rejects.
 */
const PasswordChecklist = ({ password, confirmPassword }) => {
  const result = checkPassword(password, confirmPassword);

  return (
    <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
      <Item met={result.length}>
        {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters
      </Item>
      <Item met={result.enoughCharTypes}>
        At least {PASSWORD_MIN_CHAR_TYPES} of 4:{' '}
        {result.charTypes.map((type, index) => (
          <span key={type.key} className={type.met ? 'font-semibold' : ''}>
            {type.label.toLowerCase()}
            {index < result.charTypes.length - 1 ? ', ' : ''}
          </span>
        ))}
      </Item>
      <Item met={result.matches}>Confirm password matches</Item>
    </ul>
  );
};

export default PasswordChecklist;
