import "./card-dialog.css";

import React, { useState } from "react";

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

import type { AwesomeListElement } from "shared/types/list";
import type { PluginDefinition } from "shared/types/plugins";

import { usePlugins } from "@/contexts/plugins";

type CardModalContentExtension = Extract<
  PluginDefinition["extensions"][number],
  { type: "card.modal-content" }
>;

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
  const plugins = usePlugins();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = state?.open ?? internalOpen;
  const setOpen = state?.onOpenChange ?? setInternalOpen;

  const modalContentPlugin = plugins.plugins
    .filter((plugin) => plugins.ready.includes(plugin.id))
    .map((plugin) => ({
      plugin,
      extension: plugin.extensions.find(
        (ext): ext is CardModalContentExtension =>
          ext.type === "card.modal-content",
      ),
    }))
    .find((entry) => entry.extension !== undefined);

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
      <Dialog.Content
        aria-describedby="Detailed view of the resource card, showing description, links, tags, and notes."
        aria-description="Detailed view of the resource card, showing description, links, tags, and notes."
        align="start"
        size="4"
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

              {modalContentPlugin ? (() => {
                const PluginContent = modalContentPlugin.extension!.render;
                return (
                  <PluginContent
                    element={element}
                    context={plugins.context(modalContentPlugin.plugin.id)}
                  />
                );
              })() : (
                  <div>No Content</div>
              )}
            </Flex>
          </Box>
        </ScrollArea>
      </Dialog.Content>
    </Dialog.Root>
  );
};
