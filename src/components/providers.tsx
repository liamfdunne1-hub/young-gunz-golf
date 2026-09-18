import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { makeQueryClient } from "@/lib/query";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#12283F",
            border: "1px solid rgba(196,163,90,0.35)",
            color: "#F4EFE4",
          },
        }}
      />
    </QueryClientProvider>
  );
}
