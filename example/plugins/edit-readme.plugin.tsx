import "./edit-readme-dialog.css";

import "@uiw/react-markdown-preview/markdown.css";
import "@uiw/react-md-editor/markdown-editor.css";
import "katex/dist/katex.min.css";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { EyeOpenIcon, Half1Icon, InfoCircledIcon, Pencil1Icon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Text,
} from "@radix-ui/themes";
import MDEditor from "@uiw/react-md-editor";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { ToggleGroup } from "shared/components/ui/toggle-group";
import { useTheme } from "shared/contexts/theme";
import type { PluginContext, PluginDefinition } from "shared/types/plugins";

const README_PATH = "README.md";

type ViewMode = "edit" | "live" | "preview";

interface EditReadmeButtonProps {
  context: PluginContext;
}

const EditReadmeButton: React.FC<EditReadmeButtonProps> = ({ context }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [isLoaded, setIsLoaded] = useState(false);

  const [localValue, setLocalValue] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load README when dialog opens (fetches lazily if not already in the working copy).
  useEffect(() => {
    if (!open) return;

    setIsLoaded(false);

    context.repository.get(README_PATH).then((content) => {
      setLocalValue(content);
      setIsLoaded(true);
    }).catch(() => {
      setLocalValue("");
      setIsLoaded(true);
    });
  }, [open]);

  const handleReadmeChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      setLocalValue(next);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        context.repository.write(README_PATH, next);
      }, 500);
    },
    [context.repository],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <IconButton size="3" variant="classic">
          <InfoCircledIcon width={20} height={20} />
        </IconButton>
      </Dialog.Trigger>
      <style>
        {`
          .rt-BaseDialogScrollPadding {
            padding: 0 !important;
          }
        `}
      </style>
      <Dialog.Content
        align="start"
        aria-describedby="Dialog for viewing and editing the repository's README file."
        aria-description="Dialog for viewing and editing the repository's README file. If you have edit permissions, you can switch between edit, live, and preview modes to modify the README content in markdown format."
        size="4"
        className="!p-4 !top-0 !left-0 !right-0 !m-0 !w-screen !h-screen !max-w-none !max-h-none"
      >
        <Dialog.Description className="sr-only">
          Dialog for viewing and editing the repository's README file. If you
          have edit permissions, you can switch between edit, live, and preview
          modes to modify the README content in markdown format.
        </Dialog.Description>
        <ScrollArea style={{ height: "100%" }} className="max-w-5xl pt-8 mx-auto">
          <Flex direction="column" p="0" gap="4">
            <Flex direction="column" gap="0">
              <Flex direction="row" justify="between" align="center">
                <Dialog.Title size="8" weight="bold" className="sr-only !m-0">
                  Readme
                </Dialog.Title>
                <Heading size="8" weight="bold" className="!m-0">
                  Readme
                </Heading>
                <Flex direction="row" gap="2" align="center">
                  <ToggleGroup.Root
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => {
                      if (value) setViewMode(value as ViewMode);
                    }}
                  >
                    <ToggleGroup.Item value="edit" aria-label="Edit only">
                      <Pencil1Icon />
                    </ToggleGroup.Item>
                    <ToggleGroup.Item value="live" aria-label="Split view">
                      <Half1Icon />
                    </ToggleGroup.Item>
                    <ToggleGroup.Item value="preview" aria-label="Preview only">
                      <EyeOpenIcon />
                    </ToggleGroup.Item>
                  </ToggleGroup.Root>
                  <Dialog.Close>
                    <Button variant="outline">Close</Button>
                  </Dialog.Close>
                </Flex>
              </Flex>
              {!isLoaded ? (
                <Text color="gray" size="3">
                  Loading…
                </Text>
              ) : !localValue ? (
                <Text color="gray" size="3">
                  No readme available.
                </Text>
              ) : (
                <Box data-color-mode={theme}>
                  <style>{`
                    .w-md-editor-text-input,
                    .w-md-editor-text-pre .code-line {
                      font-size: 1rem !important;
                      line-height: 1rem !important;
                    }
                    .w-md-editor-text-pre .code-line {
                      display: block;
                    }
                  `}</style>
                  <MDEditor
                    textareaProps={{ placeholder: "Add your notes here..." }}
                    hideToolbar
                    value={localValue}
                    onChange={handleReadmeChange}
                    preview={viewMode}
                    height={400}
                    visibleDragbar={false}
                    className="!bg-transparent !border-none !shadow-none !p-0"
                    previewOptions={{
                      remarkPlugins: [remarkMath],
                      rehypePlugins: [rehypeKatex],
                    }}
                  />
                </Box>
              )}
            </Flex>
          </Flex>
        </ScrollArea>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default {
  id: "edit-readme",
  name: "Edit Readme",
  description:
    "Adds a header button to view and edit the repository's README file in markdown format.",
  version: "1.0.0",
  extensions: [
    {
      type: "site.header-action",
      render: EditReadmeButton,
    },
  ],
} satisfies PluginDefinition;
