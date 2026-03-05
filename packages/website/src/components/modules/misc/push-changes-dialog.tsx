import * as yaml from "js-yaml";

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
import React, { useState, useMemo, type ComponentProps } from "react";
import { z } from "zod/v4";
import ReactDiffViewer from "react-diff-viewer-continued";

import { toast } from "sonner";

import { useTheme } from "shared/contexts/theme";
import type { AwesomeList } from "shared/types/list";

import { useList } from "@/contexts/list";
import { usePlugins } from "@/contexts/plugins";
import { useGitHubAuth } from "@/hooks/github-auth";
import { createRepositoryService } from "@/hooks/repository-service";

// @ts-ignore: idk
import buildTimeStorage from "virtual:plugin-storage";
import { useModals } from "@/contexts/dialogs";

interface PushChangesDialogProps {
  children?: React.ReactNode;
  yamlContent: AwesomeList;
}

const PushChangesFormSchema = z.object({
  repository: z
    .string()
    .register(MetadataRegistry, { label: "Repository*", disabled: true }),
  path: z
    .string()
    .register(MetadataRegistry, { label: "YAML File Path*", disabled: true }),
  message: z
    .string()
    .min(1)
    .max(48)
    .register(MetadataRegistry, { label: "Commit Message*", disabled: false }),
});

export const PushChangesDialog: React.FC<PushChangesDialogProps> = ({
  children,
  yamlContent,
}) => {
  const githubAuth = useGitHubAuth();
  const { clear: clearChanges, syncRemoteList, content } = useList();
  const { storage }  = usePlugins();
  const { theme } = useTheme();

  const { isOpen: dialogOpen, setOpen: setDialogOpen } = useModals("push-changes-dialog");

  const { oldYaml, newYaml, hasYamlChanges } = useMemo(() => {
    const { readme: _oldReadme, ...oldYamlData } = content.old;
    const { readme: _newReadme, ...newYamlData } = yamlContent;

    const oldYaml = yaml.dump(oldYamlData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    const newYaml = yaml.dump(newYamlData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    return { oldYaml, newYaml, hasYamlChanges: oldYaml !== newYaml };
  }, [content.old, yamlContent]);

  const { oldReadme, newReadme, hasReadmeChanges } = useMemo(() => {
    const oldReadme = content.old.readme || "";
    const newReadme = yamlContent.readme || "";
    return { oldReadme, newReadme, hasReadmeChanges: oldReadme !== newReadme };
  }, [content.old.readme, yamlContent.readme]);

  /**
   * Produces a flat list of { pluginId, filename, oldContent, newContent }
   * for every staged file that has actually changed vs. the build-time snapshot.
   */
  const storageDiffs = useMemo(() => {
    const diffs: Array<{
      pluginId: string;
      filename: string;
      oldContent: string;
      newContent: string;
    }> = [];

    for (const pluginId of Object.keys(storage.staged.content)) {
      for (const filename of Object.keys(storage.staged.content[pluginId])) {
        const newContent = storage.staged.content[pluginId][filename];
        const oldContent = buildTimeStorage?.[pluginId]?.[filename] ?? "";

        if (newContent !== oldContent) {
          diffs.push({ pluginId, filename, oldContent, newContent });
        }
      }
    }

    return diffs;
  }, [storage.staged.content]);

  const hasStorageChanges = storageDiffs.length > 0;

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

        const github = createRepositoryService({
          token: githubAuth.token,
          owner: __CONFIGURATION__.repository.owner,
          repo: __CONFIGURATION__.repository.name,
        });

        // Commit list changes.
        if (hasYamlChanges) {
          const { readme: _readme, ...yamlData } = yamlContent;
          const serialisedYaml = yaml.dump(yamlData, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
          });
          await github.write(data.path, serialisedYaml, data.message);
        }

        if (hasReadmeChanges) {
          const readmePath = data.path.replace(/[^/]+$/, "README.md");
          await github.write(
            readmePath,
            yamlContent.readme ?? "",
            `${data.message} (update README)`,
          );
        }

        // Commit each staged plugin storage file.
        for (const { pluginId, filename, newContent } of storageDiffs) {
          const filePath = `${__CONFIGURATION__.storage.path}/${pluginId}/${filename}`;
          await github.write(filePath, newContent, data.message);
        }

        toast.success("Changes pushed successfully!", {
          description: "The repository has been updated",
        });

        setDialogOpen(false);

        // Optimistic update: mark local state as clean.
        syncRemoteList(yamlContent);
        storage.staged.sync();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        toast.error("Failed to push changes", {
          description: errorMessage,
        });
      }
    } else if (tag === "discard") {
      clearChanges();
      storage.staged.sync();
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
              path: __CONFIGURATION__.list.path,
              repository: `${__CONFIGURATION__.repository.owner}/${__CONFIGURATION__.repository.name}`,
              message: "chore: update",
            }}
            schema={PushChangesFormSchema}
            onError={handleError}
            onSubmit={handleSubmit}
          >
            <Flex direction="column" gap="4">
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

              <AutoForm.Content />

              {/* Preview Changes Section */}
              <Box>
                <Heading size="3" mb="2">
                  Preview Changes
                </Heading>
                <Tabs.Root defaultValue="yaml">
                  <Tabs.List>
                    <Tabs.Trigger value="yaml">
                      list.yaml {hasYamlChanges && "(Modified)"}
                    </Tabs.Trigger>
                    {hasReadmeChanges && (
                      <Tabs.Trigger value="readme">
                        README.md (Modified)
                      </Tabs.Trigger>
                    )}
                    {hasStorageChanges && (
                      <Tabs.Trigger value="storage">
                        Plugin Storage{" "}
                        <Badge ml="1" color="orange" variant="soft" size="1">
                          {storageDiffs.length}
                        </Badge>
                      </Tabs.Trigger>
                    )}
                  </Tabs.List>

                  <Box pt="3">
                    {/* list.yaml diff */}
                    <Tabs.Content value="yaml">
                      {hasYamlChanges ? (
                        <Box
                          style={{
                            maxHeight: "400px",
                            overflow: "auto",
                            border: "1px solid var(--gray-6)",
                            borderRadius: "var(--radius-2)",
                          }}
                        >
                          <ReactDiffViewer
                            oldValue={oldYaml}
                            newValue={newYaml}
                            splitView={true}
                            useDarkTheme={theme === "dark"}
                            leftTitle="Current (Remote)"
                            rightTitle="New (Local)"
                            hideLineNumbers={false}
                          />
                        </Box>
                      ) : (
                        <Callout.Root>
                          <Callout.Text>
                            No changes to list.yaml file
                          </Callout.Text>
                        </Callout.Root>
                      )}
                    </Tabs.Content>

                    {/* README.md diff */}
                    {hasReadmeChanges && (
                      <Tabs.Content value="readme">
                        <Box
                          style={{
                            maxHeight: "400px",
                            overflow: "auto",
                            border: "1px solid var(--gray-6)",
                            borderRadius: "var(--radius-2)",
                          }}
                        >
                          <ReactDiffViewer
                            oldValue={oldReadme}
                            newValue={newReadme}
                            splitView={true}
                            useDarkTheme={theme === "dark"}
                            leftTitle="Current (Remote)"
                            rightTitle="New (Local)"
                            hideLineNumbers={false}
                          />
                        </Box>
                      </Tabs.Content>
                    )}

                    {/* Plugin storage diffs */}
                    {hasStorageChanges && (
                      <Tabs.Content value="storage">
                        <Flex direction="column" gap="3">
                          {storageDiffs.map(
                            ({ pluginId, filename, oldContent, newContent }) => (
                              <Box key={`${pluginId}/${filename}`}>
                                <Text size="2" weight="bold" mb="1" as="p">
                                  {__CONFIGURATION__.storage.path}/{pluginId}/
                                  {filename}
                                </Text>
                                <Box
                                  style={{
                                    maxHeight: "300px",
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
                                    rightTitle="New (Staged)"
                                    hideLineNumbers={false}
                                  />
                                </Box>
                              </Box>
                            ),
                          )}
                        </Flex>
                      </Tabs.Content>
                    )}
                  </Box>
                </Tabs.Root>
              </Box>

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
