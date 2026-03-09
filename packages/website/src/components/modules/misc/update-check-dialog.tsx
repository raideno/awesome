import {
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  InfoCircledIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Dialog,
  Flex,
  Heading,
  Link,
  Select,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import React, { useEffect, useMemo, useState } from "react";

import * as yaml from "js-yaml";
import { z } from "zod/v4";

import { toast } from "sonner";

import { useList } from "@/contexts/list";

import { GitHubService } from "storage-service";
import { createRepositoryService } from "@/hooks/repository-service";
import type { AwesomeList } from "shared/types/list";
import { replaceTextareaTypeInPlace } from "shared/lib/utils";

const AWESOME_ACTION_OWNER = "raideno";
const AWESOME_ACTION_REPO = "awesome";

interface UpdateCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTag: string;
  availableTags: string[];
  githubToken: string;
  onUpdateTriggered?: () => void;
}

const baseTextareaStyle: React.CSSProperties = {
  width: "100%",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "12px",
  border: "1px solid var(--gray-7)",
  borderRadius: "var(--radius-2)",
  padding: "10px",
  resize: "vertical",
};

interface ReleaseLinkRowProps {
  label: string;
  tag: string;
}

const ReleaseLinkRow: React.FC<ReleaseLinkRowProps> = ({ label, tag }) => {
  return (
    <Box>
      <Text size="2" weight="medium">
        {label}:{" "}
      </Text>
      <Tooltip content="Changelog">
        <Link
          href={`https://github.com/${AWESOME_ACTION_OWNER}/${AWESOME_ACTION_REPO}/releases/tag/${tag}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex gap-1 items-center"
        >
          {tag} <ExternalLinkIcon />
        </Link>
      </Tooltip>
    </Box>
  );
};

interface CompatibilityCalloutProps {
  isCheckingCompatibility: boolean;
  isTargetVersionTooOld: boolean;
  isCompatible: boolean;
  schemaPathUsed: string | null;
  compatibilityError: string | null;
}

const CompatibilityCallout: React.FC<CompatibilityCalloutProps> = ({
  isCheckingCompatibility,
  isTargetVersionTooOld,
  isCompatible,
  schemaPathUsed,
  compatibilityError,
}) => {
  if (isCheckingCompatibility) {
    return (
      <Callout.Root color="blue" size="1">
        <Callout.Icon>
          <ReloadIcon className="animate-spin" />
        </Callout.Icon>
        <Callout.Text>Checking schema compatibility…</Callout.Text>
      </Callout.Root>
    );
  }

  if (isTargetVersionTooOld) {
    return (
      <Callout.Root color="orange" size="1">
        <Callout.Icon>
          <ExclamationTriangleIcon />
        </Callout.Icon>
        <Callout.Text>{compatibilityError}</Callout.Text>
      </Callout.Root>
    );
  }

  if (isCompatible) {
    return (
      <Callout.Root color="green" size="1">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          Compatible with selected version schema
          {schemaPathUsed ? ` (${schemaPathUsed})` : ""}.
        </Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <Callout.Root color="red" size="1">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>
        {compatibilityError ||
          "Current list is not compatible with the selected version schema."}
      </Callout.Text>
    </Callout.Root>
  );
};

export const UpdateCheckDialog: React.FC<UpdateCheckDialogProps> = ({
  open,
  onOpenChange,
  currentTag,
  availableTags,
  githubToken,
  onUpdateTriggered,
}) => {
  const { content } = useList();

  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");

  const [isLoadingTargetDetails, setIsLoadingTargetDetails] = useState(false);

  const [isCheckingCompatibility, setIsCheckingCompatibility] = useState(false);
  const [isCompatible, setIsCompatible] = useState<boolean>(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(
    null,
  );
  const [compatibilityIssues, setCompatibilityIssues] = useState<string[]>([]);
  const [compatibilityIssueSource, setCompatibilityIssueSource] = useState<
    "yaml" | "schema" | null
  >(null);

  const [schemaPathUsed, setSchemaPathUsed] = useState<string | null>(null);
  const [schemaYamlTemplate, setSchemaYamlTemplate] = useState<string>("");
  const [isSchemaTypeUnsupported, setIsSchemaTypeUnsupported] = useState(false);
  const [isTargetVersionTooOld, setIsTargetVersionTooOld] = useState(false);
  const [yamlEditorValue, setYamlEditorValue] = useState("");

  const defaultTargetTag = useMemo(() => {
    return availableTags.find((tag) => tag !== currentTag) || currentTag;
  }, [availableTags, currentTag]);

  const hasRollbackOptions = useMemo(
    () => availableTags.some((tag) => tag !== currentTag),
    [availableTags, currentTag],
  );

  const toYamlWithoutReadme = (list: AwesomeList) => {
    const { readme, ...yamlData } = list;
    return yaml.dump(yamlData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
  };

  const parseYamlInput = (yamlText: string): Record<string, unknown> => {
    const parsed = yaml.load(yamlText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("YAML root must be an object");
    }

    return parsed as Record<string, unknown>;
  };

  const parseSemverFromTag = (tag: string): [number, number, number] | null => {
    const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };

  const compareSemver = (a: string, b: string): number => {
    const av = parseSemverFromTag(a);
    const bv = parseSemverFromTag(b);
    if (!av || !bv) return 0;

    for (let i = 0; i < 3; i += 1) {
      if (av[i] > bv[i]) return 1;
      if (av[i] < bv[i]) return -1;
    }

    return 0;
  };

  const buildSchemaExample = (schema: any): unknown => {
    if (!schema || typeof schema !== "object") return "<value>";

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0];
    }

    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      return buildSchemaExample(schema.anyOf[0]);
    }

    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      return buildSchemaExample(schema.oneOf[0]);
    }

    const schemaType = schema.type;

    if (schemaType === "string") return "<string>";
    if (schemaType === "number") return 0;
    if (schemaType === "integer") return 0;
    if (schemaType === "boolean") return false;

    if (schemaType === "array") {
      return schema.items ? [buildSchemaExample(schema.items)] : [];
    }

    if (schemaType === "object" || schema.properties) {
      const required = Array.isArray(schema.required) ? schema.required : [];
      const properties = schema.properties || {};
      const result: Record<string, unknown> = {};

      for (const key of required) {
        result[key] = buildSchemaExample(properties[key]);
      }

      for (const key of Object.keys(properties)) {
        if (!(key in result)) {
          result[key] = buildSchemaExample(properties[key]);
        }
      }

      return result;
    }

    return "<value>";
  };

  const checkCompatibility = async (
    targetTag: string,
    candidateYamlData: Record<string, unknown>,
  ): Promise<boolean> => {
    setIsCheckingCompatibility(true);
    setCompatibilityError(null);
    setCompatibilityIssues([]);
    setCompatibilityIssueSource(null);
    setSchemaPathUsed(null);
    setSchemaYamlTemplate("");
    setIsSchemaTypeUnsupported(false);
    setIsTargetVersionTooOld(false);

    try {
      const github = new GitHubService({
        token: githubToken,
        owner: AWESOME_ACTION_OWNER,
        repo: AWESOME_ACTION_REPO,
      });

      const schemaPaths = [
        "packages/website/awesome.list.schema.json",
        "awesome.list.schema.json",
      ];
      let schemaFile: { path: string; content: string; sha: string } | null = null;
      for (const schemaPath of schemaPaths) {
        try {
          const file = await github.read(schemaPath, targetTag);
          schemaFile = { path: schemaPath, content: file.content, sha: file.sha };
          break;
        } catch {
          // try next path
        }
      }
      if (!schemaFile) {
        throw new Error(
          `None of the files were found at ref '${targetTag}': ${schemaPaths.join(", ")}`,
        );
      }

      const jsonSchema = replaceTextareaTypeInPlace(
        JSON.parse(schemaFile.content),
      );

      const schemaExample = buildSchemaExample(jsonSchema);

      setSchemaYamlTemplate(
        yaml.dump(schemaExample, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        }),
      );

      const zodSchema = z.fromJSONSchema(jsonSchema);

      const validationResult = zodSchema.safeParse(candidateYamlData);

      setSchemaPathUsed(schemaFile.path);

      if (!validationResult.success) {
        const issues = validationResult.error.issues
          .slice(0, 8)
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            return `${path}: ${issue.message}`;
          });

        setIsCompatible(false);
        setCompatibilityIssues(issues);
        setCompatibilityIssueSource("schema");
        setCompatibilityError(
          "Current list is not compatible with the selected tag schema.",
        );
        return false;
      }

      setIsCompatible(true);
      setCompatibilityIssues([]);
      setCompatibilityError(null);
      return true;
    } catch (error) {
      setIsCompatible(false);
      setCompatibilityIssues([]);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to run compatibility check";

      const schemaMissing = errorMessage.includes(
        "None of the files were found at ref",
      );

      if (schemaMissing) {
        setIsTargetVersionTooOld(true);
        setCompatibilityIssueSource("schema");
        setCompatibilityError(
          "This version is too old and has no supported schema file. Update/rollback to this tag is disabled.",
        );
      } else if (errorMessage.includes("Unsupported type:")) {
        setIsSchemaTypeUnsupported(true);
        setCompatibilityIssueSource("schema");
        setCompatibilityError(
          `${errorMessage}. This schema cannot be auto-validated. Use the target schema and example YAML below to manually adapt your list.`,
        );
      } else {
        setCompatibilityIssueSource("schema");
        setCompatibilityError(errorMessage);
      }

      return false;
    } finally {
      setIsCheckingCompatibility(false);
    }
  };

  const loadTargetDetails = async (targetTag: string) => {
    if (!targetTag) return;

    setIsLoadingTargetDetails(true);

    try {
      const yamlToCheck = yamlEditorValue.trim()
        ? yamlEditorValue
        : toYamlWithoutReadme(content.new);
      const parsedYaml = parseYamlInput(yamlToCheck);
      await checkCompatibility(targetTag, parsedYaml);
    } catch (error) {
      console.warn("Failed to load selected tag details:", error);
      setIsCompatible(false);
      setCompatibilityError(
        error instanceof Error ? error.message : "Failed to load selected tag",
      );
      setCompatibilityIssueSource("yaml");
    } finally {
      setIsLoadingTargetDetails(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const initialYaml = toYamlWithoutReadme(content.new);
    setYamlEditorValue(initialYaml);

    const initialTarget = defaultTargetTag;
    setSelectedTag(initialTarget);
  }, [open, defaultTargetTag]);

  useEffect(() => {
    if (!open || !selectedTag) return;
    void loadTargetDetails(selectedTag);
  }, [selectedTag]);

  const handleRecheckCompatibility = async () => {
    try {
      const parsed = parseYamlInput(yamlEditorValue);
      await checkCompatibility(selectedTag, parsed);
    } catch (error) {
      setCompatibilityIssueSource("yaml");
      setCompatibilityError(
        error instanceof Error ? error.message : "Invalid YAML content",
      );
    }
  };

  const handleUpdate = async () => {
    if (!isCompatible) {
      toast.error("Compatibility check failed", {
        description:
          "Please ensure your YAML matches the target schema before deploying.",
      });
      return;
    }

    setIsUpdating(true);

    try {
      const storage = createRepositoryService({
        token: githubToken,
        owner: __CONFIGURATION__.repository.owner,
        repo: __CONFIGURATION__.repository.name,
      });

      const result = await storage.bump({
        workflowIdentifier: __CONFIGURATION__.repository.workflow.name,
        actionSlug: "raideno/awesome",
        legacyActionSlugs: ["raideno/awesome-website"],
        targetRef: selectedTag,
        commitMessage: `chore: use raideno/awesome@${selectedTag}`,
      });

      if (result.updated) {
        toast.success("Version applied", {
          description:
            "Workflow updated. The next YAML push will trigger deployment with the selected version.",
        });
      } else {
        toast.info("Version already applied", {
          description:
            "The workflow already points to this version. Push YAML changes to trigger deployment.",
        });
      }

      onUpdateTriggered?.();
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to trigger update";
      toast.error("Update failed", {
        description: errorMessage,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isRollback =
    selectedTag && currentTag && compareSemver(selectedTag, currentTag) < 0;
  const warnsAboutLegacyUpdateUi =
    isRollback && compareSemver(selectedTag, "0.2.0") < 0;
  const isDeployDisabled =
    isUpdating ||
    isLoadingTargetDetails ||
    !selectedTag ||
    !isCompatible ||
    isSchemaTypeUnsupported ||
    isTargetVersionTooOld;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Box>
          <Dialog.Title className="sr-only">Update Available</Dialog.Title>
          <Dialog.Description className="sr-only">
            A new version of awesome website is available.
          </Dialog.Description>
          <Heading>Update Available</Heading>
        </Box>

        <Flex direction="column" gap="2" mt="3">
          <Text size="2">Select a target version to update or rollback.</Text>

          <Box>
            <Text
              size="2"
              weight="medium"
              style={{ display: "block", marginBottom: "6px" }}
            >
              Target version:
            </Text>
            <Select.Root
              size="3"
              value={selectedTag}
              onValueChange={(value) => setSelectedTag(value)}
              disabled={isLoadingTargetDetails || isUpdating}
            >
              <Select.Trigger className="!w-full" />
              <Select.Content>
                {availableTags.map((tag) => (
                  <Select.Item key={tag} value={tag}>
                    {tag}
                    {tag === currentTag ? " (current)" : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {!hasRollbackOptions && (
              <Text
                size="1"
                color="gray"
                style={{ display: "block", marginTop: "4px" }}
              >
                No rollback target found yet.
              </Text>
            )}
          </Box>

          {isLoadingTargetDetails ? (
            <Callout.Root color="blue" size="1" style={{ marginTop: "8px" }}>
              <Callout.Icon>
                <ReloadIcon className="animate-spin" />
              </Callout.Icon>
              <Callout.Text>
                Loading selected tag details and compatibility status…
              </Callout.Text>
            </Callout.Root>
          ) : (
            <>
              {warnsAboutLegacyUpdateUi && (
                <Callout.Root
                  color="amber"
                  size="1"
                  style={{ marginTop: "8px" }}
                >
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>
                    You are rolling back to a version older than 0.2.0. The
                    update/rollback UI is not available there, so moving forward
                    again may be harder.
                  </Callout.Text>
                </Callout.Root>
              )}

              <ReleaseLinkRow label="Current version" tag={currentTag} />

              <ReleaseLinkRow label="Target version" tag={selectedTag} />

              <CompatibilityCallout
                isCheckingCompatibility={isCheckingCompatibility}
                isTargetVersionTooOld={isTargetVersionTooOld}
                isCompatible={isCompatible}
                schemaPathUsed={schemaPathUsed}
                compatibilityError={compatibilityError}
              />

              {schemaPathUsed && (
                <Box>
                  {schemaYamlTemplate && (
                    <Box mt="2">
                      <Text
                        size="2"
                        weight="medium"
                        style={{ display: "block", marginBottom: "6px" }}
                      >
                        YAML shape example for target version:
                      </Text>
                      <textarea
                        readOnly
                        value={schemaYamlTemplate}
                        style={{
                          ...baseTextareaStyle,
                          minHeight: "160px",
                          marginTop: "4px",
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {!isCompatible && !isTargetVersionTooOld && (
                <Box>
                  <Text
                    size="2"
                    weight="medium"
                    style={{ display: "block", marginBottom: "6px" }}
                  >
                    Current YAML (editable)
                  </Text>
                  <textarea
                    value={yamlEditorValue}
                    onChange={(event) => setYamlEditorValue(event.target.value)}
                    spellCheck={false}
                    style={{
                      ...baseTextareaStyle,
                      minHeight: "180px",
                    }}
                  />
                  {compatibilityIssueSource === "yaml" &&
                    compatibilityError && (
                      <Text
                        size="1"
                        color="red"
                        style={{ display: "block", marginTop: "8px" }}
                      >
                        YAML parse issue: {compatibilityError}
                      </Text>
                    )}
                  <Flex mt="2" gap="2" justify="end">
                    <Button
                      variant="soft"
                      onClick={handleRecheckCompatibility}
                      disabled={!selectedTag || isCheckingCompatibility}
                    >
                      Re-check Compatibility
                    </Button>
                  </Flex>
                  {compatibilityIssues.length > 0 && (
                    <Box mt="2">
                      <Text
                        size="1"
                        color="gray"
                        style={{ display: "block", marginBottom: "4px" }}
                      >
                        Compatibility issues against target schema:
                      </Text>
                      {compatibilityIssues.map((issue, idx) => (
                        <Text
                          key={`${issue}-${idx}`}
                          size="1"
                          color="red"
                          style={{ display: "block" }}
                        >
                          • {issue}
                        </Text>
                      ))}
                    </Box>
                  )}
                  {isSchemaTypeUnsupported && (
                    <Callout.Root
                      color="amber"
                      size="1"
                      style={{ marginTop: "8px" }}
                    >
                      <Callout.Icon>
                        <ExclamationTriangleIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        Auto-validation is not supported for this schema. Adapt
                        your YAML manually using the full schema and the example
                        shape above, then apply your YAML changes.
                      </Callout.Text>
                    </Callout.Root>
                  )}
                </Box>
              )}
            </>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isUpdating}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={handleUpdate}
            disabled={isDeployDisabled}
          >
            {isUpdating ? (
              <>
                <ReloadIcon className="animate-spin" />
                Applying...
              </>
            ) : selectedTag === currentTag ? (
              "Apply Current Version"
            ) : (
              "Apply Selected Version"
            )}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
