"use client";

import {
  getPasswordChecklist,
  getPasswordStrengthLabel,
  getPasswordStrengthScore,
  PASSWORD_REQUIREMENTS,
} from "@/lib/validation";
import { CheckIcon, CloseIcon } from "@/components/icons";

// Good/Strong use green rather than the gilt token here on purpose: gilt
// is a brick-red brand accent (see globals.css), and a red "Strong" label
// right next to a red "Weak" label would read as two different warnings
// instead of a weak-to-strong gradient.
const SEGMENT_COLORS = [
  "bg-noir-600", // empty
  "bg-red-400", // 1
  "bg-red-400", // 2
  "bg-amber-400", // 3
  "bg-green-400", // 4
  "bg-green-500", // 5
];

const LABEL_COLORS: Record<string, string> = {
  Weak: "text-red-500",
  Fair: "text-amber-500",
  Good: "text-green-500",
  Strong: "text-green-600",
};

export default function PasswordStrengthMeter({ password }: { password: string }) {
  const score = getPasswordStrengthScore(password);
  const label = getPasswordStrengthLabel(score);
  const checklist = getPasswordChecklist(password);

  if (!password) return null;

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: PASSWORD_REQUIREMENTS.length }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < score ? SEGMENT_COLORS[score] : "bg-noir-600"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold ${LABEL_COLORS[label]}`}>
          {label}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {checklist.map((requirement) => (
          <li
            key={requirement.id}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
              requirement.met ? "text-green-500" : "text-ivory-300"
            }`}
          >
            {requirement.met ? (
              <CheckIcon className="h-3 w-3 shrink-0" />
            ) : (
              <CloseIcon className="h-3 w-3 shrink-0" />
            )}
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
