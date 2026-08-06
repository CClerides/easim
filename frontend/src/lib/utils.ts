import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join class names, letting later ones win.
 *
 * `clsx` flattens conditionals; `twMerge` then resolves Tailwind conflicts, so
 * `cn('p-2', 'p-4')` is `p-4` rather than both. That is what makes a component
 * accepting a `className` prop actually overridable - without the merge, the
 * component's own padding and the caller's padding both land in the class list
 * and the winner is whichever CSS rule was written later, which the caller
 * cannot see.
 *
 * This is the shadcn convention, and components written against that
 * convention import it from exactly this path.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
