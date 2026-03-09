import React, { useEffect, useRef, useState } from "react";

import "@uiw/react-markdown-preview/markdown.css";
import "@uiw/react-md-editor/markdown-editor.css";
import "katex/dist/katex.min.css";

import { EyeOpenIcon, Half1Icon, Pencil1Icon } from "@radix-ui/react-icons";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
import MDEditor from "@uiw/react-md-editor";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { ToggleGroup } from "shared/components/ui/toggle-group";
import { useTheme } from "shared/contexts/theme";
import type { AwesomeListElement } from "shared/types/list";
import type { PluginContext, PluginDefinition } from "shared/types/plugins";
import { useQuery } from "@tanstack/react-query";

type ViewMode = "edit" | "live" | "preview";

interface NotesContentProps {
  element: AwesomeListElement;
  context: PluginContext;
}

const NotesContent: React.FC<NotesContentProps> = ({ element, context }) => {
  const { theme } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>("live");

  const { data, isLoading } = useQuery({
    /**
     * Currently, change of file triggers a complete refresh of the note and retrieve of this, and temproaraly sets back the data to ""
     * we should do some optimistic thing.
     */
    initialData: "",
    // queryKey: ["notes", element.id, context.repository.files.new[`storage/${context.plugin.id}/notes/${element.id}.md`]] as const,
    queryKey: ["notes", element.id] as const,
    queryFn: async (parameter) => {
      const id = parameter.queryKey[1];

      return (await context.repository.get(
        `storage/${context.plugin.id}/notes/${id}.md`,
      )) ?? "";
    },
  });

  const [note, setNote] = React.useState(data || "");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNote(data || "");
  }, [data, element.id]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setNote(value);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      context.repository.write(
        `storage/${context.plugin.id}/notes/${element.id}.md`,
        value,
      );
    }, 500);
  };

  return (
    <Flex direction="column" gap="0">
      <Flex direction="row" justify="between" align="center">
        <Heading size="5" weight="medium" className="!mb-0">
          Notes
        </Heading>
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
      </Flex>

      {isLoading ? (
        <Text color="gray" size="3">
          Loading notes…
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
            textareaProps={{ placeholder: "Add your notes here…" }}
            hideToolbar
            value={note}
            onChange={(value) => handleChange(value ?? "")}
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
  );
};

export default {
  id: "notes",
  name: "Notes",
  description:
    "Per-card markdown notes stored in the repository. Replaces the built-in notes editor.",
  version: "1.0.0",
  extensions: [
    {
      type: "card.modal-content",
      render: NotesContent,
    },
  ],
} satisfies PluginDefinition;
