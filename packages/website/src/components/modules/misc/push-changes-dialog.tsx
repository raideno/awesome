import { Portal } from "@radix-ui/react-dialog";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Heading,
  Text,
  Tabs,
  Badge,
} from "@radix-ui/themes";
import { MetadataRegistry } from "@raideno/auto-form/registry";
import { AutoForm } from "@raideno/auto-form/ui";
import React, { type ComponentProps } from "react";
import { z } from "zod/v4";
import ReactDiffViewer from "react-diff-viewer-continued";

import { toast } from "sonner";

import { useTheme } from "shared/contexts/theme";

import { useRepository } from "@/contexts/repository";
import { useGitHubAuth } from "@/hooks/github-auth";
import { useModals } from "@/contexts/dialogs";

const PushChangesFormSchema = z.object({
  repository: z
    .string()
    .register(MetadataRegistry, { label: "Repository*", disabled: true }),
  message: z
    .string()
    .min(1)
    .max(48)
    .register(MetadataRegistry, { label: "Commit Message*", disabled: false }),
});

interface PushChangesDialogProps {
  children?: React.ReactNode;
}

export const PushChangesDialog: React.FC<PushChangesDialogProps> = ({
  children,
}) => {
  const githubAuth = useGitHubAuth();
  const repository = useRepository();
  const { theme } = useTheme();

  const { isOpen: dialogOpen, setOpen: setDialogOpen } = useModals("push-changes-dialog");

  const changedFiles = Object.values(repository.changes);
  const changedCount = changedFiles.length;

  const handleError = () => {
    toast.error("Something is wrong with your inputs.");
  };

  const handleSubmit: ComponentProps<
    typeof AutoForm.Root<typeof PushChangesFormSchema>
  >["onSubmit"] = async (data, tag, _helpers) => {
    if (tag === "submit") {
      try {
        if (!githubAuth.isAuthenticated || !githubAuth.token) {
          toast.error("Authentication required", {
            description:
              "Please set your GitHub token in Settings (long-press the star button)",
          });
          return;
        }

        await repository.push(data.message);

        toast.success("Changes pushed successfully!", {
          description: "The repository has been updated.",
        });

        setDialogOpen(false);
      } catch (err) {
        toast.error("Failed to push changes", {
          description: err instanceof Error ? err.message : "An unexpected error occurred",
        });
      }
    } else if (tag === "discard") {
      repository.reset();
      setDialogOpen(false);
    } else {
      toast.error("Unknown action. Please try again.");
    }
  };

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && <Dialog.Trigger>{children}</Dialog.Trigger>}
      <Portal container={document.body}>
        <Dialog.Content style={{ maxWidth: "90vw", width: "1200px" }}>
          <AutoForm.Root
            defaultValues={{
              repository: `${__CONFIGURATION__.repository.owner}/${__CONFIGURATION__.repository.name}`,
              message: "chore: update",
            }}
            schema={PushChangesFormSchema}
            onError={handleError}
            onSubmit={handleSubmit}
          >
            <Flex direction="column" gap="4">
              {/* Header */}
              <Box>
                <Dialog.Title className="sr-only">
                  Push Changes to Repository
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Review and confirm pushing your changes to the repository.
                </Dialog.Description>
                <Flex direction="row" align="center" justify="between">
                  <Heading>Push Changes to Repository</Heading>
                  <Button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    variant="outline"
                  >
                    Close
                  </Button>
                </Flex>
                <Text>
                  Review and confirm pushing your changes to the repository.
                </Text>
              </Box>

              {/* Auth warning */}
              {!githubAuth.isAuthenticated && (
                <Callout.Root color="red">
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>
                    You are not authenticated. Please set your GitHub token in
                    Settings (long-press the star button).
                  </Callout.Text>
                </Callout.Root>
              )}

              {/* No changes notice */}
              {changedCount === 0 && (
                <Callout.Root>
                  <Callout.Text>There are no changes to push.</Callout.Text>
                </Callout.Root>
              )}

              <AutoForm.Content />

              {/* Diff preview */}
              {changedCount > 0 && (
                <Box>
                  <Flex align="center" gap="2" mb="2">
                    <Heading size="3">Preview Changes</Heading>
                    <Badge color="orange" variant="soft" size="1">
                      {changedCount} file{changedCount !== 1 ? "s" : ""}
                    </Badge>
                  </Flex>

                  <Tabs.Root defaultValue={changedFiles[0].path}>
                    <Tabs.List>
                      {changedFiles.map(({ path }) => (
                        <Tabs.Trigger key={path} value={path}>
                          {path}
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>

                    <Box pt="3">
                      {changedFiles.map(({ path, old: oldContent, new: newContent }) => (
                        <Tabs.Content key={path} value={path}>
                          <Box
                            style={{
                              maxHeight: "400px",
                              overflow: "auto",
                              border: "1px solid var(--gray-6)",
                              borderRadius: "var(--radius-2)",
                            }}
                          >
                            <ReactDiffViewer
                              oldValue={oldContent}
                              newValue={newContent}
                              splitView={true}
                              useDarkTheme={theme === "dark"}
                              leftTitle="Current (Remote)"
                              rightTitle="New (Local)"
                              hideLineNumbers={false}
                            />
                          </Box>
                        </Tabs.Content>
                      ))}
                    </Box>
                  </Tabs.Root>
                </Box>
              )}

              {/* Actions */}
              <AutoForm.Actions>
                <Flex direction="column" gap="3" justify="end">
                  <AutoForm.Action tag="discard" variant="soft" color="red">
                    Discard Changes
                  </AutoForm.Action>
                  <AutoForm.Action tag="submit" variant="classic">
                    Push Changes
                  </AutoForm.Action>
                </Flex>
              </AutoForm.Actions>
            </Flex>
          </AutoForm.Root>
        </Dialog.Content>
      </Portal>
    </Dialog.Root>
  );
};
