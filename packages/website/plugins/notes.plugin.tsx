import React, { useEffect, useState } from "react";

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
import type {
  PluginContext,
  PluginContextSetup,
  PluginDefinition,
} from "shared/types/plugins";

// -----------------------------------------------------------------------------
// Shared notes state
//
// A single in-memory map is allocated for the lifetime of the plugin. All card
// modals share it, so storage is only read once per element rather than on
// every open. The adapter exposes get/set over this map so the framework can
// wire it into React and trigger re-renders when the content changes.
// -----------------------------------------------------------------------------

const STORAGE_FILENAME = "notes.json";

type ViewMode = "edit" | "live" | "preview";
type Notes = Record<string, string>;

// Module-level map — survives re-renders, reset only on full page reload.
const notesCache = new Map<string, Notes>();
const CACHE_KEY = "all";

const readNotes = async (storage: PluginContext["storage"]): Promise<Notes> => {
  try {
    const raw = await storage.read(STORAGE_FILENAME);
    if (!raw) return {};
    return JSON.parse(raw) as Notes;
  } catch {
    return {};
  }
};

const writeNotes = async (
  storage: PluginContext["storage"],
  notes: Notes,
): Promise<void> => {
  await storage.write(STORAGE_FILENAME, JSON.stringify(notes, null, 2));
};

// The hook returned by setup.register() — set during createContext.
let useNotes: (() => [Notes, (notes: Notes) => void]) | null = null;

interface NotesContentProps {
  element: AwesomeListElement;
  context: PluginContext;
}

const NotesContent: React.FC<NotesContentProps> = ({ element, context }) => {
  const { theme } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [isLoaded, setIsLoaded] = useState(false);

  const [notes, setNotes] = useNotes!();

  const currentNote = notes[element.id] ?? "";

  useEffect(() => {
    if (notesCache.has(CACHE_KEY)) {
      setIsLoaded(true);
      return;
    }

    readNotes(context.storage).then((loaded) => {
      notesCache.set(CACHE_KEY, loaded);
      setNotes(loaded);
      setIsLoaded(true);
    });
  }, []);

  const handleChange = async (value: string) => {
    const updated = { ...notes, [element.id]: value };
    setNotes(updated);
    try {
      await writeNotes(context.storage, updated);
    } catch (error) {
      context.toast.error("Failed to save note", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
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

      {!isLoaded ? (
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
            value={currentNote}
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
    "Per-card markdown notes stored in the repository's plugin storage. Replaces the built-in notes editor.",
  version: "1.0.0",
  context: {
    setup: async (context, setup) => {
      notesCache.set(CACHE_KEY, await readNotes(context.storage));
      // // Seed the cache from storage eagerly so the first render isn't empty.
      // readNotes(context.storage).then((loaded) => {
      //   notesCache.set(CACHE_KEY, loaded);
      // });

      useNotes = setup.register<Notes>("notes", {
        get: () => notesCache.get(CACHE_KEY) ?? {},
        set: (notes) => {
          notesCache.set(CACHE_KEY, notes);
        },
      });
    },
  },
  extensions: [
    {
      type: "card.modal-content",
      render: NotesContent,
    },
  ],
} satisfies PluginDefinition;
