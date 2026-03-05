import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "shared/components/ui/sooner";
import { useTheme } from "shared/contexts/theme";

import type React from "react";

import { AlertDialogProvider } from "@/components/utils/alert-dialog";

import { EditingProvider } from "@/contexts/editing";
import { FilterProvider } from "@/contexts/filter";
import { ListProvider } from "@/contexts/list";
import { MarkersProvider } from "@/contexts/markers";
import { NetworkProvider } from "@/contexts/network";
import { PluginsProvider } from "@/contexts/plugins";
import { ModalsProvider } from "@/contexts/dialogs";

export interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const { theme } = useTheme();

  const [queryClient] = useState(() => new QueryClient());

  return (
    <>
      <Theme
        // @ts-ignore: allow custom accentColor value
        accentColor="black"
        hasBackground={false}
        radius="none"
        appearance={theme}
        panelBackground="solid"
        scaling="100%"
      >
        <QueryClientProvider client={queryClient}>
          <AlertDialogProvider>
            <NetworkProvider>
              <ModalsProvider>
                <EditingProvider>
                  <ListProvider>
                    <PluginsProvider>
                      <FilterProvider>
                        <MarkersProvider>
                          <Toaster />
                          <>{children}</>
                        </MarkersProvider>
                      </FilterProvider>
                    </PluginsProvider>
                  </ListProvider>
                </EditingProvider>
              </ModalsProvider>
            </NetworkProvider>
          </AlertDialogProvider>
        </QueryClientProvider>
      </Theme>
    </>
  );
};
