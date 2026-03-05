import "./edit-readme-dialog.css";

import "@uiw/react-markdown-preview/markdown.css";
import "@uiw/react-md-editor/markdown-editor.css";
import "katex/dist/katex.min.css";

import React, { useState } from "react";

import { EyeOpenIcon, Half1Icon, Pencil1Icon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  ScrollArea,
  Text,
} from "@radix-ui/themes";
import MDEditor from "@uiw/react-md-editor";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { ToggleGroup } from "shared/components/ui/toggle-group";
import { useTheme } from "shared/contexts/theme";

import { useEditing } from "@/contexts/editing";
import { useList } from "@/contexts/list";

type ViewMode = "edit" | "live" | "preview";

export interface EditReadmeDialogProps {
  children?: React.ReactNode;
  state?: { open: boolean; onOpenChange: (open: boolean) => void };
}

export const EditReadmeDialog: React.FC<EditReadmeDialogProps> = ({
  children,
  state,
}) => {
  const list = useList();
  const { editingEnabled } = useEditing();
  const { theme } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("live");

  const isOpen = state?.open ?? internalOpen;
  const setOpen = state?.onOpenChange ?? setInternalOpen;
  const canEdit = list.canEdit && editingEnabled;

  // Use the readme from list context
  const currentReadme = list.content.new.readme || "";

  const handleOpenChange = async (open: boolean) => {
    setOpen(open);
  };

  const handleReadmeChange = async (value: string | undefined) => {
    if (canEdit) {
      try {
        await list.update({
          readme: value || "",
        });
      } catch (error) {
        console.error("Failed to update readme:", error);
      }
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      {children && <Dialog.Trigger>{children}</Dialog.Trigger>}
      <style>
        {`
        .rt-BaseDialogScrollPadding {
          padding: 0 !important;
        }
      `}
      </style>
      <Dialog.Content
        align="start"
        aria-describedby="Dialog for viewing and editing the repository's README file. If you have edit permissions, you can switch between edit, live, and preview modes to modify the README content in markdown format."
        aria-description="Dialog for viewing and editing the repository's README file. If you have edit permissions, you can switch between edit, live, and preview modes to modify the README content in markdown format."
        size="4"
        className="!p-4 !top-0 !left-0 !right-0 !m-0 !w-screen !h-screen !max-w-none !max-h-none"
      >
        <Dialog.Description className="sr-only">
          Dialog for viewing and editing the repository's README file. If you
          have edit permissions, you can switch between edit, live, and preview
          modes to modify the README content in markdown format.
        </Dialog.Description>
        <ScrollArea
          style={{ height: "100%" }}
          className="max-w-5xl pt-8 mx-auto"
        >
          <Flex direction="column" p="0" gap="4">
            <Flex direction="column" gap="0">
              <Flex
                direction="row"
                justify="between"
                align="center"
                // className="mb-2"
              >
                <Dialog.Title size="8" weight="bold" className="sr-only !m-0">
                  Readme
                </Dialog.Title>
                <Heading size="8" weight="bold" className="!m-0">
                  Readme
                </Heading>
                <Flex direction={"row"} gap={"2"} align={"center"}>
                  {canEdit && (
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
                      <ToggleGroup.Item
                        value="preview"
                        aria-label="Preview only"
                      >
                        <EyeOpenIcon />
                      </ToggleGroup.Item>
                    </ToggleGroup.Root>
                  )}
                  <Dialog.Close>
                    <Button variant="outline">Close</Button>
                  </Dialog.Close>
                </Flex>
              </Flex>
              {!canEdit && !currentReadme ? (
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
                    textareaProps={{
                      placeholder: "Add your notes here...",
                    }}
                    hideToolbar
                    value={currentReadme}
                    onChange={handleReadmeChange}
                    preview={canEdit ? viewMode : "preview"}
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
