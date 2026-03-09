import { ReloadIcon } from "@radix-ui/react-icons";
import { Badge, Flex, Tooltip } from "@radix-ui/themes";

import { useState } from "react";

import { toast } from "sonner";

import type React from "react";

import { UpdateCheckDialog } from "@/components/modules/misc/update-check-dialog";
import { useEditing } from "@/contexts/editing";
import { useGitHubAuth } from "@/hooks/github-auth";
import { GitHubService } from "storage-service";
import { useNetwork } from "@/contexts/network";

export interface VersionBadgeProps {}

const AWESOME_ACTION_OWNER = "raideno";
const AWESOME_ACTION_REPO = "awesome";

export const VersionBadge: React.FC<VersionBadgeProps> = () => {
  const buildTag = __CONFIGURATION__.build.tag;

  const network = useNetwork();
  const { editingEnabled } = useEditing();
  const { isAuthenticated, token } = useGitHubAuth();

  const [isChecking, setIsChecking] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const isVersionCheckDisabled: [boolean, string] =
    network.state === "offline"
      ? [true, "No internet available to check for updates."]
      : !editingEnabled
        ? [true, "Enable editing to check for updates."]
        : !isAuthenticated
          ? [true, "Sign in to GitHub to check for updates."]
          : !buildTag
            ? [true, "Current build tag is missing."]
            : [false, "Click to check for updates."];

  const isClickable = !isVersionCheckDisabled[0];

  const handleBadgeClick = async () => {
    if (!isClickable || !token) return;

    setIsChecking(true);

    try {
      const github = new GitHubService({
        token,
        owner: AWESOME_ACTION_OWNER,
        repo: AWESOME_ACTION_REPO,
      });

      const tags = await github.versions(50);
      const resolvedTags = tags.map((tag) => tag.name);
      setAvailableTags(
        resolvedTags.length > 0 ? resolvedTags : buildTag ? [buildTag] : [],
      );

      setUpdateDialogOpen(true);
    } catch (error) {
      console.error("Failed to check for updates:", error);
      toast.error("Failed to check for updates", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdateTriggered = () => {
    toast.success("Version updated", {
      description: "Workflow reference has been updated to the selected tag",
    });
  };

  const getBadgeContent = () => {
    if (isChecking) {
      return (
        <Flex align="center" gap="1">
          <ReloadIcon width={12} height={12} className="animate-spin" />
          Checking...
        </Flex>
      );
    }
    return buildTag;
  };

  const getTooltipContent = () => {
    return `Version: ${buildTag || "development"}. ${isVersionCheckDisabled[1]}`;
  };

  return (
    <>
      <Tooltip content={getTooltipContent()}>
        <Badge
          color="gray"
          variant="soft"
          size="1"
          onClick={isClickable ? handleBadgeClick : undefined}
          style={{
            cursor: isClickable ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          {getBadgeContent()}
        </Badge>
      </Tooltip>

      {token && updateDialogOpen && (
        <UpdateCheckDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          currentTag={buildTag || ""}
          availableTags={availableTags}
          githubToken={token}
          onUpdateTriggered={handleUpdateTriggered}
        />
      )}
    </>
  );
};
