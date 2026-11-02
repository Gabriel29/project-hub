import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { setLanguage } from "../i18n";

afterEach(cleanup);

beforeEach(() => setLanguage("ro"));
