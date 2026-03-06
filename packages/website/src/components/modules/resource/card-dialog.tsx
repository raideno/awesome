import "./card-dialog.css";

import React, { useEffect, useState } from "react";

import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Link,
  ScrollArea,
  Text,
} from "@radix-ui/themes";

import { Portal } from "@radix-ui/react-dialog";

import type { AwesomeListElement } from "shared/types/list";

import { usePlugins } from "@/contexts/plugins";

export interface ResourceCardDialogProps {
  children?: React.ReactNode;
  element: AwesomeListElement;
  state?: { open: boolean; onOpenChange: (open: boolean) => void };
}

export const ResourceCardDialog: React.FC<ResourceCardDialogProps> = ({
  children,
  element,
  state,
}) => {
  const PluginsManager = usePlugins();
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  const isOpen = state?.open ?? internalOpen;
  const setOpen = state?.onOpenChange ?? setInternalOpen;

  const extensions = PluginsManager.plugins
    .filter((plugin) => PluginsManager.ready.includes(plugin.id))
    .flatMap((plugin) =>
      plugin.extensions
        .filter((extension) => extension.type === "card.modal-content")
        .map((extension, extensionIndex) => ({
          extension,
          pluginId: plugin.id,
          extensionKey: `${plugin.id}:${extension.type}:${extensionIndex}`,
        })),
    );

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      {children && <Dialog.Trigger>{children}</Dialog.Trigger>}
      <style>
        {`
        .rt-BaseDialogScrollPadding {
          padding: 0 !important;
        }
      `}
      </style>
      <Portal container={portalContainer ?? undefined}>
        <Dialog.Content
          aria-describedby="Detailed view of the resource card, showing description, links, tags, and notes."
          aria-description="Detailed view of the resource card, showing description, links, tags, and notes."
          align="start"
          size="4"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          className="!p-4 !top-0 !left-0 !right-0 !m-0 !w-screen !h-screen !max-w-none !max-h-none"
        >
          <Dialog.Description className="sr-only">
            Detailed view of the resource card, showing description, links, tags,
            and notes.
          </Dialog.Description>
          <ScrollArea
            scrollbars="vertical"
            style={{ height: "100%" }}
          >
            <Box className="max-w-5xl pt-8 mx-auto">
              <Flex direction="column" p="0" gap="4">
                <Box>
                  <Flex direction="row" gap="4" justify="between" align="center">
                    <Box>
                      <Dialog.Title size="8" weight="bold" className="!m-0">
                        {element.name}
                      </Dialog.Title>
                    </Box>
                    <Flex direction="row" gap="2" align="center">
                      <Dialog.Close>
                        <Button variant="outline">Close</Button>
                      </Dialog.Close>
                    </Flex>
                  </Flex>
                  {element.description && (
                    <Text size="4" className="markdown-content leading-relaxed">
                      {element.description}
                    </Text>
                  )}
                </Box>

                {element.link && (
                  <Flex direction="column" gap="2">
                    <Heading size="5" weight="medium">
                      Links
                    </Heading>
                    <Link
                      href={element.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="!underline"
                    >
                      {element.link}
                    </Link>
                  </Flex>
                )}

                {element.tags.length > 0 && (
                  <Flex direction="column" gap="2">
                    <Heading size="5" weight="medium">
                      Tags
                    </Heading>
                    <Flex direction="row" wrap="wrap" gap="2">
                      {element.tags.map((tag) => (
                        <Badge key={tag} size="2">
                          {tag}
                        </Badge>
                      ))}
                    </Flex>
                  </Flex>
                )}

                {extensions.map(({ extension, pluginId, extensionKey }) => {
                  const ExtensionComponent = extension.render;

                  return (
                    <ExtensionComponent
                      key={extensionKey}
                      element={element}
                      context={PluginsManager.context(pluginId)}
                    />
                  );
                })}
              </Flex>
            </Box>
          </ScrollArea>
        </Dialog.Content>
      </Portal>
    </Dialog.Root>
  );
};
