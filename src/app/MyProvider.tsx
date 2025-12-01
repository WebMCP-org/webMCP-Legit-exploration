"use client";

import { LegitProvider } from "@legit-sdk/react";
import type { ReactNode } from "react";

export default function MyProvider({ children }: { children: ReactNode }): ReactNode {
  return <LegitProvider>{children}</LegitProvider>;
}
