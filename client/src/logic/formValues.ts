import type { FormEvent } from "react";

export function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
}
