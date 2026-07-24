"use client";

import { ReactNode } from "react";
import { Providers } from "@/lib/providers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </TooltipProvider>
    </Providers>
  );
}
